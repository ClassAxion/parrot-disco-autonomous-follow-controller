export default interface Telemetry {
    altitude?: {
        value: number;
        lastReceivedAt: number;
    };
    location?: {
        latitude: number;
        longitude: number;
        lastReceivedAt: number;
    };
    speed?: {
        value: number;
        lastReceivedAt: number;
    };
    heading?: {
        value: number;
        lastReceivedAt: number;
    };
}
