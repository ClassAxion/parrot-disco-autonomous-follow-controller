import Telemetry from './interface/Telemetry.interface';
import { io, Socket } from 'socket.io-client';
import logger from './utils/logger';
import Algorithm from './module/Algorithm.module';

const targets: { [key: string]: string } = {
    DISCO_1: 'localhost:9999',
    // DISCO_1: 'localhost:9991',
    // DISCO_2: 'localhost:9992',
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
        logger.info(`Connecting to ${targets[id]} (${id})`);

        const url = targets[id];

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

    logger.info(`Events attached`);

    logger.info(`Starting following algorithm..`);

    const algorithm = new Algorithm();

    let lastRoll: number;
    let lastThrottle: number;

    while (true) {
        algorithm.setTelemetry('A', telemetry['DISCO_1']);
        algorithm.setTelemetry('B', telemetry['DISCO_2']);

        const roll = algorithm.getRollAxis();
        console.log(`Roll: ${roll}`);

        const throttle = algorithm.getThrottle();
        console.log(`Throttle: ${throttle}`);

        const distance = algorithm.getDistance();
        console.log(`Last distance: ${distance}m`);

        if (!lastRoll || lastRoll !== roll) {
            sockets['DISCO_1'].emit('move', { roll });
        }

        if (!lastThrottle || lastThrottle !== throttle) {
            sockets['DISCO_1'].emit('move', { throttle });
        }

        lastRoll = roll;
        lastThrottle = throttle;

        await new Promise<void>((r) => setTimeout(r, 100));
    }
})();
