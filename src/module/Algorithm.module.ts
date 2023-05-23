import Telemetry from 'interface/Telemetry.interface';

global.window = {
    screen: {
        //@ts-ignore
        devicePixelRatio: 1,
    },
};
global.document = {
    documentElement: {
        //@ts-ignore
        style: {},
    },
    //@ts-ignore
    getElementsByTagName: function () {
        return [];
    },
    //@ts-ignore
    createElement: function () {
        return {};
    },
};
//@ts-ignore
global.navigator = {
    userAgent: 'nodejs',
    platform: 'nodejs',
};

import { latLng } from 'leaflet';

const RAD2DEG = 180 / Math.PI;
const DEG2RAD = Math.PI / 180;

export default interface Config {
    required_distance: number;
    required_distance_margin: number;
    direction_margin: number;
    roll: {
        min: number;
        max: number;
    };
    throttle: {
        max_slowing: number;
        max_full_power: number;
        rest: number;
    };
}

export default class Algorithm {
    // A followings B
    private telemetry: { [key: string]: Telemetry } = {};

    private distance: number;

    private config: Config;

    private firstThrottleWithLoad: number;

    constructor(config?: Config) {
        if (!config) {
            //@ts-ignore
            this.config = {
                required_distance: 50,
                required_distance_margin: 25,
                direction_margin: 10,
                roll: {
                    min: 5,
                    max: 50,
                },
                throttle: {
                    max_slowing: -50,
                    max_full_power: 10,
                    rest: 5,
                },
            };
        } else {
            this.config = config;
        }
    }

    private calculateDistance() {
        const discoALatLng = latLng(this.telemetry['A'].location.latitude, this.telemetry['A'].location.longitude);
        const discoBLatLng = latLng(this.telemetry['B'].location.latitude, this.telemetry['B'].location.longitude);

        this.distance = discoALatLng.distanceTo(discoBLatLng);

        return this.distance;
    }

    public setTelemetry(id: 'A' | 'B', telemetry: Telemetry): void {
        this.telemetry[id] = telemetry;
    }

    private fixBearing(value) {
        if (value < 0) value += 360;
        if (value > 365) value -= 360;

        return value;
    }

    private calculateBearingBetweenLocations() {
        const {
            location: { latitude: latitude1, longitude: longitude1 },
        } = this.telemetry['A'];

        const {
            location: { latitude: latitude2, longitude: longitude2 },
        } = this.telemetry['B'];

        let dphi = DEG2RAD * (latitude1 + latitude2) * 0.5e-6;

        const cphi = Math.cos(dphi);

        dphi = DEG2RAD * (latitude2 - latitude1) * 1.0e-6;

        let dlam = DEG2RAD * (longitude2 - longitude1) * 1.0e-6;

        dlam *= cphi;

        return this.fixBearing(RAD2DEG * Math.atan2(dlam, dphi));
    }

    private getCurrentDirection(id: 'A' | 'B') {
        return this.telemetry[id].heading.value; // check if this value works
    }

    private rollMapWithConfig(value) {
        if (value > 0) {
            if (value < this.config.roll.min) return this.config.roll.min;
            if (value > this.config.roll.max) return this.config.roll.max;
        } else if (value < 0) {
            if (value > -this.config.roll.min) return -this.config.roll.min;
            if (value < -this.config.roll.max) return -this.config.roll.max;
        }

        return value;
    }

    public getRollAxis() {
        const targetDirection = this.calculateBearingBetweenLocations();

        const currentDirection = this.getCurrentDirection('A');

        const provisional = targetDirection - currentDirection;

        let turn = 0;

        if (-180 < provisional && provisional <= 180) {
            turn = provisional;
        } else if (provisional > 180) {
            turn = provisional - 360;
        } else if (provisional <= -180) {
            turn = provisional + 360;
        }

        if (Math.abs(turn) < this.config.direction_margin) return 0;

        if (turn > 0 || turn < 0) return this.rollMapWithConfig(turn);

        return 0;
    }

    public getDistance() {
        return this.distance;
    }

    private valueMap(value, in_min, in_max, out_min, out_max) {
        return ((value - in_min) * (out_max - out_min)) / (in_max - in_min) + out_min;
    }

    public getThrottle() {
        const distance = this.calculateDistance();

        if (distance > this.config.required_distance + this.config.required_distance_margin) {
            // We are too far, shoud speed up

            if (!this.firstThrottleWithLoad) this.firstThrottleWithLoad = Date.now();

            const diff = Date.now() - this.firstThrottleWithLoad;

            if (diff > (this.config.throttle.max_full_power + this.config.throttle.rest) * 1000) {
                this.firstThrottleWithLoad = null;
            }

            if (diff > this.config.throttle.max_full_power * 1000) {
                return 0;
            }

            return 100;
        } else if (distance > this.config.required_distance) {
            // We are too far away (but within margin), we have to speed up becasue we will fall out from margin

            this.firstThrottleWithLoad = null;

            const throttle = this.valueMap(
                distance - this.config.required_distance,
                0,
                this.config.required_distance_margin,
                0,
                50,
            );

            return throttle;
        } else if (distance < this.config.required_distance - this.config.required_distance_margin) {
            // We are too too close, we have to slow down becasue we will overtake

            this.firstThrottleWithLoad = null;

            return this.config.throttle.max_slowing;
        } else if (distance < this.config.required_distance) {
            // We are too close (but within margin), we have to slow down becasue we will slowly overtake

            this.firstThrottleWithLoad = null;

            const throttle = this.valueMap(
                -Math.abs(distance - this.config.required_distance),
                0,
                this.config.required_distance_margin,
                0,
                -this.config.throttle.max_slowing,
            );

            return throttle;
        }

        this.firstThrottleWithLoad = null;

        return 0;
    }
}
