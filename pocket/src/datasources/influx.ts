import { InfluxDB } from '@influxdata/influxdb-client'

export const influxClient = new InfluxDB({ url: "http://influx.nachonodes.com:8086", token: `${process.env.INFLUX_TOKEN}` })
export const writeAPI = influxClient.getWriteApi("nachonodes", "nodes")