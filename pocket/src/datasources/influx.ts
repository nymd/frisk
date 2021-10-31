import { InfluxDB } from '@influxdata/influxdb-client'

export const influxClient = new InfluxDB({ url: "http://localhost:8086", token: "-QVD3pKtY_ZBdfLZYxclSA6frrzMVEaPqLlNY93dQbFSkO6RLJ-HsbA8X22xwzTaEGSlRqgaZYCBIyUwOzd-QA==" })
export const writeAPI = influxClient.getWriteApi("nachonodes", "nodes")