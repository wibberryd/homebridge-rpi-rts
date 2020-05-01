# Somfy RTS plugin for Homebridge
This [Homebridge](https://github.com/homebridge/homebridge) plugin allows to control any device with the Somfy RTS technology (rolling shutters, awnings, ...) with a [Raspberry Pi](https://www.raspberrypi.org) connected to a simple 433 MHz transmitter. This plugin is not compatible with the Somfy IO technology.

**Warning:** this plugin requires Homebridge to run with root privilege in order to send signals through the Raspberry Pi's GPIO.

## 1. Hardware setup

### 1.1. Parts
- Raspberry Pi (tested with 4B, but should work with any version)
- 433 MHz RF transmitter [like this](https://i.pinimg.com/474x/cb/47/a8/cb47a81619e16eb344d89ee03a382dc1.jpg)
- 433.42 MHz saw resonator (.42 is important)
- Any 17 cm antenna
- 3 female to female jumper wires

### 1.2. Modification of the transmitter
Somfy RTS is using a frequency of 433.42 MHz instead of the usual 433.92 MHz. To optimize the range of our transmitter, we need to replace the original saw resonator.
1. Remove the original resonator by pulling it while heating its 3 pins with the soldering iron
2. Clean the remaining solder
3. Solder the 433.42 MHz resonator instead
4. Solder the antenna to the ANT pad

### 1.3. Connection to the Raspberry Pi
Using the female to female jumper wires, connect the transmitter to the [Raspberry Pi GPIO](https://www.raspberrypi.org/documentation/usage/gpio/) like this:
- Transmitter GND to Raspberry Pi GND
- Transmitter VCC to Raspberry Pi +5V
- Transmitter ATAD (DATA) to Raspberry Pi GPIO 4

## 2. Software setup

### 2.1. Raspberry Pi setup
If your Raspberry Pi is not setup yet, follow the [official documentation](https://www.raspberrypi.org/documentation/) to install a Raspbian OS of your choice. For a Homebridge server, a Raspbian Lite version (i.e. without Graphical User Interface) with SSH enabled to control the Raspberry Pi remotely from another computer is good starting point.

Install Node.js, Homebridge and Homebridge Config UI X according to [those instructions](https://github.com/homebridge/homebridge/wiki/Install-Homebridge-on-Raspbian).

### 2.2. Installation of the pigpio C library
Install the [pigpio C library](https://github.com/joan2937/pigpio):
```
sudo apt update
sudo apt install pigpio
```

### 2.3. Configuration of the Homebridge service
The pigpio library requires root privilege, so we need to give root privilege to Homebridge. Because Homebridge runs as a service, we need to do the following modifications:
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

### 2.4. Installation of the plugin
The easiest way is to login to **Homebridge Config UI X**, go to the **Plugins** tab, search **Homebridge-RPi-Rts** and click **Install**.

Alternatively you can run this command:
```
sudo npm install -g homebridge-rpi-rts
```

## 3. Configuration

It is important to understand how Somfy RTS is working. It is the physical Somfy devices (e.g. roller shutters) that memorize which remotes can control it and not the other way around (it's not the remotes that memorize the devices). Each Somfy device can memorize several remotes. For each of them it memorizes two values:
- The **unique remote ID** that we setup during the configuration
- A **rolling code** that is incremented each time a button is pressed on this remote

### 3.1. Configuration of the plugin
This step aims to create "virtual" remotes to control Somfy devices.

Again, the easiest way is to login to **Homebridge Config UI X**, go to the **Plugins** tab, locate the **homebridge-rpi-rts** plugin and click **Settings**. Fill the form and create as many blocks as remotes that you want, giving each a unique ID, then click save and restart Homebridge.

Alternatively you can edit the config file and add the following block inside the **accessories** section, repeated as many times as the number of remotes you need:
```json
{
    "name": "XXXXXX",
    "id": 12345,
    "accessory": "Raspberry Pi Somfy RTS Remote"
}
```
Fields:
- `name` is the name of the accessory as it will appear in Apple Home App (required)
- `id` is the unique ID of the virtual Somfy RTS remote to choose between 0 and 16777216 (required)
- `accessory` must be "Raspberry Pi Somfy RTS Remote" (required)

### 3.2. Programmation of the Somfy devices
**Warning:** if performed incorrectly, this step can create a chaos in your Somfy installation, which can be solved only by a hard reset of the Somfy devices and reprogramming from scratch (setting upper/lower limits, memorizing physical remotes, ...).

Repeat those steps for each remote you have created:
1. Login to **Homebridge Config UI X** and go to the **Accessories** tab.
2. Take the current physical RTS remote that controls the Somfy device you want to programm. If the remote controls several channels, make sure to select the good one.
3. With this physical remote, make the Somfy device go approximately half way between open and close.
4. On the same remote, locate the **Prog** button (usually a small button on the back) and press it until the Somfy device does a short up and down movement.
5. Without waiting, press the **Prog** button on the Config UI X interface of the virtual remote you want to add to the Somfy device. The Somfy device does a short up and down movement to confirm the registration of this new remote.

### 3.3. Rolling codes
**Warning:** each Somfy device memorizes the rolling code of each remote controlling this device. This rolling code is incremented each time a button is pressed on the remote.

The plugin creates a rolling code for each of the virtual remotes. When a new virtual remote is created, the plugin start a rolling code with value `1`. Rolling codes are stored in .txt files in `/var/lib/homebridge` named with the IDs of the associated virtual remotes.

Those files should not be lost because there is no way to recover the rolling codes. Somfy devices won't execute commands sent by a remote with a different rolling code than the one it has in memory for the remote with this ID. 

## Links
- [Pushstack](https://pushstack.wordpress.com/somfy-rts-protocol/) for a detailed description of the Somfy RTS protocol.
- [joan2937](https://github.com/joan2937/pigpio) for the pigpio C library.
- [fivdi](https://github.com/fivdi/pigpio) for the pigpio javascript wrapper.
- [Nickduino](https://github.com/Nickduino/Pi-Somfy) for a python implementation of the Somfy RTS protocol