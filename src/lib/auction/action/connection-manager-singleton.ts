import { ConnectionManager } from "@/lib/auction/action/connection-manager-class";

console.log("connection-manager-singleton.ts_called");

const globalForConnectionManager = globalThis as unknown as { __myapp_connectionManagerInstance: ConnectionManager };

console.log("connection-manager-singleton.ts_globalForConnectionManager.__myapp_connectionManagerInstance", globalForConnectionManager.__myapp_connectionManagerInstance);
const connectionManager = globalForConnectionManager.__myapp_connectionManagerInstance ?? new ConnectionManager();

console.log("connection-manager-singleton.ts_connectionManager", connectionManager);
if (process.env.NODE_ENV !== "production") globalForConnectionManager.__myapp_connectionManagerInstance = connectionManager;

export { connectionManager };
