import Telemetry from './interface/Telemetry.interface';
import { io, Socket } from 'socket.io-client';
import logger from './utils/logger';

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

        logger.info(`Disco (${id}) connected`);
    }

    logger.info(`All disco's connected`);

    for (const id in targets) {
        attachEvents(id, sockets[id]);
    }
})();
