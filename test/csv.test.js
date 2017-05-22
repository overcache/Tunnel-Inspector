/* eslint func-names: ["error", "never"], prefer-arrow-callback: ["error", "never"]  */
const { expect } = require("chai")
const fs = require("fs")
const path = require("path")
const sqlite3 = require("sqlite3").verbose()
const csv = require(path.join(__dirname, "../csv.js"))
const dbpath =path.join(__dirname, "aa.db")
const tunnelsPath = path.join(__dirname, "tunnels-all.csv")
const ltePath = path.join(__dirname, "lte-all.csv")


describe("Test module csv", function () {

  this.timeout(300000)
  before(async function () {
    const db = new sqlite3.Database(dbpath)
    await csv.createTunnelsTable(db)
    await csv.createBusinessesTable(db)
    await csv.extractTunnelsPromise(db, tunnelsPath)
    await csv.extractBusinessesPromise(db, ltePath)
    await csv.close(db)
  })

  it("extractTunnels", async function () {
    const db = new sqlite3.Database(dbpath)
    const row = await csv.get(db, "select * from tunnels where t_id = '32213'")
    expect(row.t_id).to.be.equal("32213")
    expect(row.name).to.be.equal("231-白沙核心调度环2-2-11602-南宁隆安古潭中真福乍LTE")
    expect(row.src_element).to.be.equal("231-白沙核心调度环2-2")
    expect(row.src_port).to.be.equal("GigabitEthernet10/2/1")
    expect(row.dest_element).to.be.equal("11602-南宁隆安古潭中真福乍LTE")
    expect(row.dest_port).to.be.equal("1-1")
    expect(row.middle_elements).to.be.equal("176-南宁白沙环7-10公用设备\n122-崇左天等本地汇聚环2（南宁）\n121-南宁隆安本地汇聚环2（南宁）\n5111-南宁隆安县乔建站\n13447-南宁隆安古潭古楼LTE(外）\n9209-南宁隆安古潭中真TD")
    expect(row.middle_in_ports).to.be.equal("5-2\n6-2\n11-1\n1-1\n1-1\n2-3")
    expect(row.middle_out_ports).to.be.equal("13-2\n7-1\n3-1\n1-5\n2-1\n2-2")
    await csv.close(db)
  })

  it("extractBusinesses", async function () {
    const db = new sqlite3.Database(dbpath)
    const row = await csv.get(db, "select * from businesses where b_id = '371764'")
    expect(row.b_id).to.be.equal("371764")
    expect(row.name).to.be.equal("南宁青秀区东郊分局_HLH新-网管")
    expect(row.src_port).to.be.equal("4-8")
    expect(row.work_dest_port).to.be.equal("Eth-Trunk6.157")
    expect(row.guard_dest_port).to.be.equal("Eth-Trunk6.157")
    expect(row.work_tunnel).to.be.equal("104-南宁东郊汇聚环11-1-237-608核心调度环1-2-静态CR-608方向")
    expect(row.guard_tunnel).to.be.equal("104-南宁东郊汇聚环11-1-233-白沙核心调度环1-2-静态CR-白沙新")
    await csv.close(db)
  })

  it("inspect id 1 by csv", async function () {
    const db = new sqlite3.Database(dbpath)
    await csv.inspect(db, 1)
    await csv.close(db)
  })

  it("inspect id 2", async function () {
    const db = new sqlite3.Database(dbpath)
    await csv.inspect(db, 2)
    await csv.close(db)
  })

  it("inspect all", async function () {
    const db = new sqlite3.Database(dbpath)
    const { count } = await csv.get(db, "select count(*) as count from businesses")
    for (let i = 1; i <= 100; i += 1) {
      try {
        await csv.inspect(db, i)
      } catch(error) {
        console.log(error)
      }
    }
  })
})
