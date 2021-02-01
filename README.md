# Homebridge-RPi-RTS
A [Homebridge](https://github.com/homebridge/homebridge) plugin to add HomeKit compatibility to Somfy RTS devices (rolling shutters, blinds, awnings, ...) requiring only a [Raspberry Pi](https://www.raspberrypi.org) and a simple 433 MHz transmitter.

| Advantages | Limitations |
| ---------- | ----------- |
| <ul><li>Cheap: should be under 10 €, or under 40 € in total with a Raspberry Pi Zero WH and accessories included</li><li>Up to 150 Somfy RTS devices controlled simultaneously (HomeKit limit per bridge)</li><li>Self sufficient: pairing with Somfy RTS devices can be performed directly in Homebridge or Apple Home App with the Prog button</li></ul> | <ul><li>Requires a bit of hacking with the hardware and software</li><li>Requires to give root privilege to Homebridge</li><li>Each device appears as 4 buttons in HomeKit: Up, Down, My, Prog, instead of a Window Covering control (limitation due Somfy RTS technology)</li><li>Personal project without any guarantee of updates and support</li></ul> |

## Hardware Setup
Somfy RTS uses a frequency of 433.42 MHz instead of the usual 433.92 MHz, which requires to replace the resonator to increase the range of the transmitter. The range is typically less than 3 meters at 433.92 MHz and more than 20 meters at 433.42 MHz with a 17 cm antenna (quarter wavelength).

### Parts
- Raspberry Pi (tested successfully on Zero WH and 4 Model B) with micro SD card and power source
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

To install the plugin, go to Homebridge Config UI X (the visual interface of Homebridge accessible with a browser), go to the Plugins tab, search for homebridge-rpi-rts and click Install.

Alternatively, use the following command line in a terminal window:
```
sudo npm install -g homebridge-rpi-rts
```

### Modification of Homebridge Service
Root privileges are required to send waveform signals to the transmitter through the Rapsberry Pi GPIO.

1. Open the file `/etc/systemd/system/homebridge.service`:
```
sudo nano /etc/systemd/system/homebridge.service
```

Change the user to root: 
```
User=root
```

Comment the line starting by `CapabilityBoundingSet` by adding `#` at the beginning of it:
```
# CapabilityBoundingSet=CAP_IPC_LOCK CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_NET_RAW CAP_SETGID CAP_SETUID CAP_SYS_CHROOT CAP_CHOWN CAP_FOWNER CAP_DAC_OVERRIDE CAP_AUDIT_WRITE CAP_SYS_ADMIN
```

`Ctrl + O` to save and `Ctrl + X` to exit.

The final file should look like this (some lines may differ depending on Node.js and Homebridge configuration, leave them as they are):
```
sudo cat /etc/systemd/system/homebridge.service
```
```
[Unit]
Description=Homebridge
Wants=network-online.target
After=syslog.target network-online.target

[Service]
Type=simple
User=root
PermissionsStartOnly=true
WorkingDirectory=/var/lib/homebridge
EnvironmentFile=/etc/default/homebridge
ExecStartPre=-run-parts /etc/hb-service/homebridge/prestart.d
ExecStartPre=-/usr/local/lib/node_modules/homebridge-config-ui-x/dist/bin/hb-service.js before-start $HOMEBRIDGE_OPTS
ExecStart=/usr/local/lib/node_modules/homebridge-config-ui-x/dist/bin/hb-service.js run $HOMEBRIDGE_OPTS
Restart=always
RestartSec=3
KillMode=process
# CapabilityBoundingSet=CAP_IPC_LOCK CAP_NET_ADMIN CAP_NET_BIND_SERVICE CAP_NET_RAW CAP_SETGID CAP_SETUID CAP_SYS_CHROOT CAP_CHOWN CAP_FOWNER CAP_DAC_OVERRIDE CAP_AUDIT_WRITE CAP_SYS_ADMIN
AmbientCapabilities=CAP_NET_RAW CAP_NET_BIND_SERVICE

[Install]
WantedBy=multi-user.target
```

2. Open the file `/etc/default/homebridge`:
```
sudo nano /etc/default/homebridge
```
Append `--allow-root` at the end of the `HOMEBRIDGE_OPTS` line (the `/var/lib/` path may differ, leave it as it is):
```
HOMEBRIDGE_OPTS=-I -U "/var/lib/homebridge" --allow-root
```

`Ctrl + O` to save and `Ctrl + X` to exit.

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

The remotes send 3 values:
- Its unique ID
- A rolling code that is incremented each time a button is pressed on the remote
- A command: Up, Down, My, Prog

When a device receives a signal it does the following:
- It verifies that the unique ID of the remote is in the list of its registered remotes
- It verifies that the rolling code is the same or very close to the one it knows for this remote ID
- It increments the rolling code for this remote ID (so it keeps the same value than the one stored on the remote)
- It performs the command (move up, down, ...)

A same remote can even be registered on many devices (intentionally or inadvertently), and thus control simultaneoulsy many devices.

### Configuration of the Plugin
Go to Homebridge Config UI X, go to the Plugins tab, and click on Settings under Homebridge Rpi Rts.

Create as many accessories as needed (e.g. one per device to control). Each accessory is equivalent to a virtual remote. Each accessory must get a unique ID.

Alternatively, edit the JSON config file and add the following block inside the accessories array for each accessory to create:
```json
{
    "name": "XXXXXX",
    "id": 12345,
    "prog": true,
    "accessory": "Somfy RTS Remote"
}
```
Where:
- `name` is the name of the accessory as it will appear in HomeKit (required)
- `id` is the unique ID of the virtual Somfy RTS remote to choose between 0 and 16777216 (required)
- `prog` is an option to show (true) or hide (false) the Prog button (optional)
- `accessory` must be "Somfy RTS Remote" (required)

### Pairing
For each virtual remote created:

1. Take the current physical remote that controls the Somfy device to be programmed. If the remote controls several channels, make sure to select the good one.

2. With this remote, use the Up/Down/My buttons to make the device approximately half way between the opened and closed positions (the aim is to not be totally opened or totally closed).

3. On the same remote, locate the Prog button (usually a small button on the back) and keep it pressed until the Somfy device does a short up and down movement.

4. Without waiting, press the Prog button on the virtual remote to pair with this device. The Somfy device should do again a short up and down movement confirming the registration of this new remote.

5. Wait at least 5 minutes before pairing another remote to avoid pairing a remote to multiple devices.

### Hiding the Prog Button
Once pairing is complete, it can be useful to hide the Prog button to avoid pressing it inadvertently. Go to Homebridge Config UI X, then in the Plugins tab, click on the Settings button. Uncheck Show Prog Button, click Save and restart Homebridge.

## Backup
Any loss of unique IDs and/or rolling codes, leads to the impossibility to control the Somfy RTS devices.

Even worst, it makes unregistering the virtual remotes impossible, because the unique ID and correct rolling code are necessary to send the command to unregister a remote. The only solution would be a hard reset of the device involving accessing the motor, resetting the upper/lower limits and registering the remotes from scratch.

As rolling codes are incremented each time a signal is sent, it is strongly advised to perform Homebridge backups frequently.

Rolling codes are stored in text files in the Homebridge storage path with the unique ID as the name, e.g. 12345.txt, and are thus normally backed-up during Homebridge backups.

## Troubleshooting

- Error below: make sure to follow the instructions in Modification of Homebridge Service
```
+---------------------------------------------------------+
|Sorry, you don't have permission to run this program. |
|Try running as root, e.g. precede the command with sudo. |
+---------------------------------------------------------+
```

- Error `initMboxBlock: init mbox zaps failed`: reboot the Raspberry Pi: `sudo reboot`.

- Error `Can't lock /var/run/pigpio.pid`: stop current pigpio daemon instance: `sudo killall pigpiod`.

If it does not solve the problem, please open an issue in GitHub with as much information on the environment and error as possible (Raspberry Pi model, Node.js version, Homebridge version, ...)

## Links
- [Pushstack](https://pushstack.wordpress.com/somfy-rts-protocol/) for a detailed description of the Somfy RTS protocol.
- [joan2937](https://github.com/joan2937/pigpio) for the pigpio C library.
- [fivdi](https://github.com/fivdi/pigpio) for the pigpio javascript wrapper.
- [Nickduino](https://github.com/Nickduino/Pi-Somfy) for a python implementation of the Somfy RTS protocol.
