const RpiGpioRts = require('./RpiGpioRts');
let Service, Characteristic;

module.exports = homebridge => {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory('homebridge-rpi-rts', 'Somfy RTS Remote', SomfyRtsRemoteAccessory);
};

/**
 * Class simulating a Somfy RTS Remote Accessory for Homebridge
 * with 4 'stateless' switches: Up, Down, My, Prog
 *
 * @class SomfyRtsRemoteAccessory
 */
class SomfyRtsRemoteAccessory {

	/**
	 * Constructor of the class SomfyRtsRemoteAccessory
	 *
	 * @constructor
	 * @param {Object} log - The Homebridge log
	 * @param {Object} config - The Homebridge config data filtered for this item
	*/
	constructor(log, config) {
		this.log = log;
		if (!config || !config.name || !config.id) {
			throw new Error(`Invalid or missing configuration.`);
		}
		this.config = config;
		this.emitter = new RpiGpioRts(log, config);
		
		this.delay = 500;
		
		this.states = { 'Up': false, 'Down': false, 'My': false, 'Prog': false };
		
		this.switchServices = {};
		
		['Up', 'Down', 'My', 'Prog'].forEach(button => {
		
			this.switchServices[button] = new Service.Switch(`${this.config.name} ${button}`, button);
			
			this.switchServices[button]
				.getCharacteristic(Characteristic.On)
				.on('get', this.getOn.bind(this, button))
				.on('set', this.setOn.bind(this, button));
		});
		
		this.log.debug(`Initialized accessory`);
	}
	
	/**
	 * Getter for the 'On' characteristic of the 'Switch' service
	 *
	 * @method getOn
	 * @param {Function} callback - A callback function from Homebridge
	 * @param {String} button - 'Up', 'Down', 'My', 'Prog'
	*/
	getOn(button, callback) {
		this.log.debug(`Function getOn called for button ${button}`);
		const value = this.states[button];
		callback(null, value);
	}
	
	/**
	 * Setter for the 'On' characteristic of the 'Switch' service
	 *
	 * @method setOn
	 * @param {Object} value - The value for the characteristic
	 * @param {Function} callback - A callback function from Homebridge
	 * @param {String} button - 'Up', 'Down', 'My', 'Prog'
	*/
	setOn(button, value, callback) {
		this.log.debug(`Function setOn called for button ${button} with value ${value}`);
		this.states[button] = value;
		if (value === true) {
			this.emitter.sendCommand(button);
			this.resetSwitchWithTimeout(button);
		}
		callback(null);
	}
	
	/**
	 * Reset the switch to false to simulate a stateless behavior
	 *
	 * @method resetSwitchWithTimeout
	 * @param {String} button - 'Up', 'Down', 'My', 'Prog'
	*/
	resetSwitchWithTimeout(button) {
		this.log.debug(`Function resetSwitchWithTimeout called for button ${button}`);
		setTimeout(function() {
			this.switchServices[button].setCharacteristic(Characteristic.On, false);
		}.bind(this), this.delay);
	}
	
	/**
	 * Mandatory method for Homebridge
	 * Return a list of services provided by this accessory
	 *
	 * @method getServices
	 * @return {Array} - An array containing the services
	*/
	getServices() {
		this.log.debug(`Function getServices called`);
		return Object.values(this.switchServices);
	}
}