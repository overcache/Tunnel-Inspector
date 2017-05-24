/* eslint func-names: ["error", "never"], prefer-arrow-callback: ["error", "never"]  */
const { expect } = require("chai")
const fs = require("fs")
const path = require("path")
const sqlite3 = require("sqlite3").verbose()
const csv = require(path.join(__dirname, "../csv.js"))
const dbpath =path.join(__dirname, "aa.db")
const LTETunnelsPath = "/Users/simon/Downloads/CMCC/LTE业务Tunnel信息表.csv"
const nonLTETunnelsPath = "/Users/simon/Downloads/CMCC/非LTE业务Tunnel信息表.csv"
const LTEPath = "/Users/simon/Downloads/CMCC/LTE业务信息表.csv"
const nonLTEPath = ["/Users/simon/Downloads/CMCC/非LTE业务CES.csv", "/Users/simon/Downloads/CMCC/非LTE业务ETH.csv"]
const nonLTEGuardGroupPath = "/Users/simon/Downloads/CMCC/非LTE业务Tunnel保护组.csv"


describe("Test module csv", function () {

  this.timeout(300000)
  before(async function () {
    const db = new sqlite3.Database(dbpath)
    // await csv.createTunnelsTable(db, "lte")
    // await csv.createBusinessesTable(db)
    // await csv.createTunnelsTable(db, "non_lte")
    await csv.createNonLTEBusinessesTable(db)
    // await csv.createNonLTETunnelsGuardGroupTable(db)
    // console.log("create tables finished")
    // await csv.extractTunnelsPromise(db, LTETunnelsPath, "lte")
    // console.log("extract lte tunnels finished")
    // await csv.extractTunnelsPromise(db, nonLTETunnelsPath, "non_lte")
    // console.log("extract non-lte tunnels finished")
    // await csv.extractBusinessesPromise(db, LTEPath)
    // console.log("extract lte business finished")
    await csv.extractNonLTEBusinessesPromise(db, nonLTEPath[0], "ces")
    console.log("extract non-lte ces finished")
    await csv.extractNonLTEBusinessesPromise(db, nonLTEPath[1], "eth")
    console.log("extract non-lte eth finished")
    // await csv.extractNonLTETunnelsGuardGroupPromise(db, nonLTEGuardGroupPath)
    // console.log("extract non-lte tunntles guard group finished")
    await csv.close(db)
  })

  it("total lte tunnels records", async function () {
    const db = new sqlite3.Database(dbpath)
    const { count } = await csv.get(db, "select count(*) as count from lte_tunnels")
    expect(count).to.be.equal(17225)
  })

  it("total non-lte-tunnels records", async function () {
    const db = new sqlite3.Database(dbpath)
    const { count } = await csv.get(db, "select count(*) as count from non_lte_tunnels")
    expect(count).to.be.equal(12361)
  })

  it("total businesses records", async function () {
    const db = new sqlite3.Database(dbpath)
    const { count } = await csv.get(db, "select count(*) as count from lte_businesses")
    expect(count).to.be.equal(9586)
  })

  it("total non-lte-businesses records", async function () {
    const db = new sqlite3.Database(dbpath)
    const { count } = await csv.get(db, "select count(*) as count from non_lte_businesses")
    // ETH: (1814-8)/2
    // CES: (17880-8)/2
    expect(count).to.be.equal(9839)
  })

  it("total non-lte-guard-group records", async function () {
    const db = new sqlite3.Database(dbpath)
    const { count } = await csv.get(db, "select count(*) as count from non_lte_tunnels_guard_group")
    expect(count).to.be.equal(4006)
  })

  it("extractTunnels", async function () {
    const db = new sqlite3.Database(dbpath)
    const row = await csv.get(db, "select * from lte_tunnels where t_id = '32213'")
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
    const row = await csv.get(db, "select * from lte_businesses where b_id = '371764'")
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

  it.skip("inspect all", async function () {
    const db = new sqlite3.Database(dbpath)
    const { count } = await csv.get(db, "select count(*) as count from lte_businesses")
    let total = 0
    for (let i = 1; i <= 100; i += 1) {
      try {
        await csv.inspect(db, i)
      } catch(error) {
        total += 1
        console.log(error.message)
      }
    }
    console.log(`total error: ${total}`)
  })

  it("inspect 南宁西乡塘区锦虹棉纺织公司LTE-网管", function (done) {
    const sql = String.raw`select
      b.name as b_name,
      w.src_element as b_src_element,
      b.src_port as b_src_port,
      b.work_dest_port as b_work_desk_port,
      b.guard_dest_port as b_guard_desk_port,
      w.name as work_name,
      w.src_element as work_src_element,
      w.src_port as work_src_port,
      w.dest_element as work_dest_element,
      w.dest_port as work_dest_port,
      w.middle_elements as work_middle_elements,
      w.middle_in_ports as work_middle_in_ports,
      w.middle_out_ports as work_middle_out_ports,
      g.name as guard_name,
      g.src_element as guard_src_element,
      g.src_port as guard_src_port,
      g.dest_element as guard_dest_element,
      g.dest_port as guard_dest_port,
      g.middle_elements as guard_middle_elements,
      g.middle_in_ports as guard_middle_in_ports,
      g.middle_out_ports as guard_middle_out_ports
      from lte_businesses as b
      inner join lte_tunnels as w
        on b.work_tunnel = w.name
      inner join lte_tunnels as g
        on b.guard_tunnel = g.name
      where b.name = "南宁西乡塘区锦虹棉纺织公司LTE-网管"
      `

    const result = [
      [
        "南宁西乡塘区锦虹棉纺织公司LTE-网管",
        "工作",
        "11011-南宁西乡塘区锦虹棉纺织公司LTE（IP微波）#1-2",
        "236-608核心调度环1-1#Eth-Trunk1.924",
        "11011-南宁西乡塘区锦虹棉纺织公司-236-608核心调度环1-1-608方向",
        "11011-南宁西乡塘区锦虹棉纺织公司LTE（IP微波）#1-1 <===> 1298-南宁西乡塘区连畴村戏台岭站TD#2-2\n\
1298-南宁西乡塘区连畴村戏台岭站TD#2-1 <===> 1297-南宁兴宁区高峰林场站TD（替换）#1-1\n\
1297-南宁兴宁区高峰林场站TD（替换）#2-1 <===> 5800-南宁兴宁区邕武路106号红树林TD（室外）#2-1\n\
5800-南宁兴宁区邕武路106号红树林TD（室外）#1-1 <===> 1294-南宁兴宁区内环装饰市场3站TD#1-1\n\
1294-南宁兴宁区内环装饰市场3站TD#2-1 <===> 89-南宁电视塔汇聚环9#1-10\n\
89-南宁电视塔汇聚环9#11-2 <===> 90-南宁608汇聚环9#7-2\n\
90-南宁608汇聚环9#11-2 <===> 236-608核心调度环1-1#GigabitEthernet9/0/1",
        "11011-南宁西乡塘区锦虹棉纺织公司LTE（IP微波）#1-1 <===> 1298-南宁西乡塘区连畴村戏台岭站TD#2-2",
      ],
      [
        "南宁西乡塘区锦虹棉纺织公司LTE-网管",
        "保护",
        "11011-南宁西乡塘区锦虹棉纺织公司LTE（IP微波）#1-2",
        "234-白沙核心调度环1-1#Eth-Trunk1.927",
        "11011-南宁西乡塘区锦虹棉纺织公司-234-白沙核心调度环1-1-白沙方向",
        "11011-南宁西乡塘区锦虹棉纺织公司LTE（IP微波）#1-1 <===> 1298-南宁西乡塘区连畴村戏台岭站TD#2-2\n\
1298-南宁西乡塘区连畴村戏台岭站TD#1-1 <===> 1299-南宁西乡塘区连畴村2队站TD（兴宁）#2-1\n\
1299-南宁西乡塘区连畴村2队站TD（兴宁）#1-1 <===> 1300-南宁西乡塘区皂角村2站TD#2-1\n\
1300-南宁西乡塘区皂角村2站TD#1-1 <===> 1301-南宁西乡塘区北湖大板市场站TD#2-1\n\
1301-南宁西乡塘区北湖大板市场站TD#1-1 <===> 88-南宁北郊汇聚环9#1-9\n\
88-南宁北郊汇聚环9#7-2 <===> 87-南宁金棉楼汇聚环9#11-2\n\
87-南宁金棉楼汇聚环9#7-2 <===> 86-南宁百万庄汇聚环9#11-2\n\
86-南宁百万庄汇聚环9#7-2 <===> 234-白沙核心调度环1-1#GigabitEthernet14/0/1",
        "11011-南宁西乡塘区锦虹棉纺织公司LTE（IP微波）#1-1 <===> 1298-南宁西乡塘区连畴村戏台岭站TD#2-2",
      ],
    ]
    const db = new sqlite3.Database(dbpath)
    db.each(sql, (err, row) => {
      expect(csv.mergeRow(row)).to.be.deep.equal(result)
    }, (err, total) => {
      done()
    })
  })
})
