# Somfy RTS Plugin for Homebridge
This is a [Homebridge](https://github.com/homebridge/homebridge) plugin for Somfy RTS devices (rolling shutters, awnings, ...) requiring only a [Raspberry Pi](https://www.raspberrypi.org) and a simple 433 MHz transmitter to work.

The cost should be under $10 (not counting the Raspberry Pi), but it requires a bit of tinkering with the hardware and software, and to **run Homebridge with root privilege**.

This plugin exposes a group of 4 buttons for each Somfy RTS devices in HomeKit: Up, Down, My, and Prog, just as the usual Somfy RTS remotes. Because there is not feedback system with the Somfy RTS technology it is impossible to know the current open or close position of the device.

This plugin is not compatible with Somfy IO technology.

## Hardware Setup
Somfy RTS uses a frequency of 433.42 MHz instead of the usual 433.92 MHz, which requires to replace the saw resonator to increase the range of the transmitter. The range is typically less than 3 meters at 433.92 MHz and more than 20 meters at 433.42 MHz with a 17 cm antenna (quarter wavelength).

### Parts
- Raspberry Pi (tested with 4B, but should work with any version)
- 433 MHz RF transmitter ([example](https://i.pinimg.com/474x/cb/47/a8/cb47a81619e16eb344d89ee03a382dc1.jpg))
- 433.42 MHz saw resonator ([example](https://www.ebay.com/sch/i.html?_nkw=433.42+resonator))
- 17 cm antenna (a straight piece of wire of 17 cm works well)
- 3 female to female jumper wires ([example](https://www.ebay.com/sch/i.html?_nkw=female+to+female+jumper+wire))

### Modification of the Transmitter
1. Remove the original resonator by pulling it while heating its 3 pins with a soldering iron
2. Clean the remaining solder
3. Solder the 433.42 MHz resonator instead
4. Solder the antenna to the ANT pad

### Connection to the Raspberry Pi
Using the female to female jumper wires, connect the transmitter to the [Raspberry Pi GPIO](https://www.raspberrypi.org/documentation/usage/gpio/):
- Transmitter GND to Raspberry Pi GND
- Transmitter VCC to Raspberry Pi +5V
- Transmitter ATAD (DATA) to Raspberry Pi GPIO 4

## Software Setup

### Installation
If not done yet, install Raspberry Pi OS, Node.js and Homebridge. You can get there directly by installing the  [Homebridge Raspberry Pi Image](https://github.com/homebridge/homebridge-raspbian-image/wiki/Getting-Started).

Install the [pigpio C library](https://github.com/joan2937/pigpio) with the following command in a terminal window:
```
sudo apt install pigpio
```

Install the plugin directly in **Homebridge Config UI X** (the visual interface of Homebridge accessible with a browser) by searching for **homebridge-rpi-rts** in the **Plugins tab**, or with the following command in a terminal window:
```
sudo npm install -g homebridge-rpi-rts
```

**Do not modify the settings yet**, as there are extra steps before.


### Modification of Homebridge Service
Root privileges are required to send waveform signals to the transmitter through the Rapsberry Pi GPIO. If Homebridge runs as a service (which is usually the case), follow those steps to provide root privilege to Homebridge:

1. Open the file `/etc/systemd/system/homebridge.service` and replace all its content by:
```
[Unit]
Description=Homebridge
Wants=network-online.target
After=syslog.target network-online.target

[Service]
WorkingDirectory=/var/lib/homebridge
EnvironmentFile=/etc/default/homebridge
ExecStartPre=/bin/run-parts /etc/hb-service/homebridge/prestart.d
ExecStartPre=/usr/lib/node_modules/homebridge-config-ui-x/dist/bin/hb-service.js before-start $HOMEBRIDGE_OPTS
ExecStart=/usr/lib/node_modules/homebridge-config-ui-x/dist/bin/hb-service.js run $HOMEBRIDGE_OPTS
KillMode=process

[Install]
WantedBy=multi-user.target
```
Save and close.

2. Open the file `/etc/default/homebridge` and append `--allow-root` at the end of the HOMEBRIDGE_OPTS line:
```
HOMEBRIDGE_OPTS=-I -U "/var/lib/homebridge" --allow-root
```
Save and close.

3. Refresh systemd:
```
sudo systemctl daemon-reload
```

4. Restart hb-service:
```
sudo hb-service restart
```

## Configuration
Each Somfy device listens to a list of remotes that were previously registered on this device.

The remotes send only 3 values:
- Its **unique ID**
- A **rolling code** that is incremented each time a button is pressed on the remote
- A **command**: Up, Down, My, Prog, ...

When a device receives a signal it does the following:
- It verifies that the unique ID of the remote is in the list of its registered remotes
- It verifies that the rolling code is the same or very close to the one it knows for this remote ID
- It increments the rolling code for this remote ID (so it keeps the same value than the one stored on the remote)
- It performs the command (move up, down, ...)

A same remote can even be registered on many devices (intentionally or accidentally), and thus control simultaneoulsy many devices.

**WARNING:** **IDs and rolling codes should not be lost**, because devices will stop responding to the remotes with a wrong ID or a wrong rolling code, including the **impossibility to unregister a remote**. The only solution would be a hard reset of the device involving accessing the motor, resetting the upper/lower limits and registering the remotes from scratch.

### Configuration of the Plugin
Configure the plugin directly in **Homebridge Config UI X** by going to the **Plugins** tab and clicking on **Settings** under **Homebridge-Rpi-Rts** (easiest method) or edit the JSON config file.

Create as many accessories as you need (e.g. one per device to control). Each accessory is equivalent to a virtual remote. **Each accessory must get a unique ID**. Keep of copy of the unique IDs.

For the JSON config file method only:
Add the following block inside the **accessories** array for each accessory to create:
```json
{
    "name": "XXXXXX",
    "id": 12345,
    "accessory": "Somfy RTS Remote"
}
```
Where:
- `name` is the name of the accessory as it will appear in Apple Home App (required)
- `id` is the unique ID of the virtual Somfy RTS remote to choose between 0 and 16777216 (required)
- `accessory` must be "Somfy RTS Remote" (required)

### Pairing
For each virtual remote created:

1. Take the current physical remote that controls the Somfy device you want to program. If the remote controls several channels, make sure to select the good one.

2. With this remote, use the Up/Down/My buttons to position the shutter or awning approximately half way between the opened and closed positions (the aim is to not be totally opened or totally closed).

3. On the same remote, locate the **Prog** button (usually a small button on the back) and keep it pressed until the Somfy device does a short up and down movement.

4. Without waiting, press the **Prog** button on the virtual remote you want to pair with this device. The Somfy device should do again a short up and down movement confirming the registration of this new remote.

5. Wait at least 5 minutes before pairing another remote to avoid pairing a remote to multiple devices.


## Links
- [Pushstack](https://pushstack.wordpress.com/somfy-rts-protocol/) for a detailed description of the Somfy RTS protocol.
- [joan2937](https://github.com/joan2937/pigpio) for the pigpio C library.
- [fivdi](https://github.com/fivdi/pigpio) for the pigpio javascript wrapper.
- [Nickduino](https://github.com/Nickduino/Pi-Somfy) for a python implementation of the Somfy RTS protocol.
