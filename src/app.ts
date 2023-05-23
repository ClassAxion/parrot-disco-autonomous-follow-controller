import Telemetry from './interface/Telemetry.interface';
import { io, Socket } from 'socket.io-client';
import logger from './utils/logger';
import Algorithm from './module/Algorithm.module';
import dotenv from 'dotenv';

dotenv.config();

const useRoll = true;
const useThrottle = false;

const discoFollower = process.env.FOLLOWER || process.argv[2];
const discoTarget = process.env.TARGET || process.argv[3];

if (!discoFollower || !discoTarget) process.exit(1);

const targets: { [key: string]: string } = {
    DISCO_1: discoFollower,
    DISCO_2: discoTarget,
};

const sockets: { [key: string]: Socket } = {};
const telemetry: { [key: string]: Telemetry } = {};

function attachEvents(id: string, socket: Socket) {
    socket.on('altitude', ({ altitude }) => {
        telemetry[id].altitude = {
            value: altitude,
            lastReceivedAt: Date.now(),
        };
    });

    socket.on('location', ({ latitude, longitude }) => {
        telemetry[id].location = {
            latitude,
            longitude,
            lastReceivedAt: Date.now(),
        };
    });

    socket.on('heading', ({ heading }) => {
        telemetry[id].heading = {
            value: heading,
            lastReceivedAt: Date.now(),
        };
    });

    socket.on('speed ', ({ speed }) => {
        telemetry[id].speed = {
            value: speed,
            lastReceivedAt: Date.now(),
        };
    });
}

(async () => {
    for (const id in targets) {
        const url = targets[id];

        // logger.info(`Connecting to ${url} (${id})`);
        logger.info(`Connecting to ${id}`);

        const socket = io(url);

        await new Promise<void>((r) => socket.once('connect', () => r()));

        sockets[id] = socket;
        telemetry[id] = {};

        socket.on('disconnect', () => {
            logger.error(`Connection with ${id} lost, aborting`);
            process.exit(1);
        });

        logger.info(`Disco (${id}) connected`);
    }

    logger.info(`All disco's connected`);

    for (const id in targets) {
        attachEvents(id, sockets[id]);
    }

    logger.info(`Events attached, starting in 15s..`);

    await new Promise((r) => setTimeout(r, 15 * 1000));

    logger.info(`Starting following algorithm..`);

    const algorithm = new Algorithm();

    let lastRoll: number = 0,
        lastThrottle: number = 0;

    while (true) {
        algorithm.setTelemetry('A', telemetry['DISCO_1']);
        algorithm.setTelemetry('B', telemetry['DISCO_2']);

        const roll = algorithm.getRollAxis();
        const throttle = algorithm.getThrottle();

        const distance = algorithm.getDistance();

        console.log(`Roll: ${roll}, Throttle: ${throttle}, Last distance ${distance}m`);

        if (!lastRoll || lastRoll !== roll || roll === 25 || roll === -25) {
            if (useRoll) {
                sockets['DISCO_1'].emit('move', { roll });

                // console.log(`Moving roll: ${roll}`);
            }
        }

        if (!lastThrottle || lastThrottle !== throttle) {
            if (useThrottle) {
                sockets['DISCO_1'].emit('move', { throttle });

                // console.log(`Moving throttle: ${throttle}`);
            }
        }

        lastRoll = roll;
        lastThrottle = throttle;

        await new Promise<void>((r) => setTimeout(r, 100));
    }
})();
