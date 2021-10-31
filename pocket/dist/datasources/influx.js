"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAPI = exports.influxClient = void 0;
const influxdb_client_1 = require("@influxdata/influxdb-client");
exports.influxClient = new influxdb_client_1.InfluxDB({ url: "http://influx.nachonodes.com:8086", token: `${process.env.INFLUX_TOKEN}` });
exports.writeAPI = exports.influxClient.getWriteApi("nachonodes", "nodes");
//# sourceMappingURL=influx.js.map