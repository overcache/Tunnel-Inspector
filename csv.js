const fs = require("fs")
const readline = require("readline")
const lineReader = require("line-reader")
const parse = require("csv-parse")
const parseSync = require("csv-parse/lib/sync")
// const sqlite3 = require("sqlite3").verbose()
const assert = require("assert")
// const { expect } = require("chai")

function test() {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("before")
      resolve()
    }, 3000)
  })
}

function close(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err)
      }
      resolve()
    })
  })
}

function get(db, sql) {
  return new Promise((resolve, reject) => {
    db.get(sql, (err, row) => {
      if (err) {
        console.log(err)
        reject(err)
      }
      resolve(row)
    })
  })
}

function stmtRun(db, stmt, values) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      stmt.run(values)
      resolve()
    })
  })
}

function all(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, rows) => {
      if (err) {
        console.log(err)
        reject(err)
      }
      resolve(rows)
    })
  })
}

function promiseParse(line) {
  return new Promise((resolve, reject) => {
    parse(line, (err, row) => {
      if (err) {
        console.log(err)
        // reject(err)
      }
      resolve(row)
    })
  })
}

function createTunnelsTable(db) {
  return new Promise((resolve) => {
    db.serialize(() => {
      const stmt = String.raw`CREATE TABLE IF NOT EXISTS "tunnels" (
                  "id" integer primary key autoincrement not null,
                  "t_id" text,
                  "name" text not null,
                  "src_element" text not null,
                  "src_port" text not null,
                  "dest_element" text not null,
                  "dest_port" text not null,
                  "middle_elements" text not null,
                  "middle_in_ports" text not null,
                  "middle_out_ports" text not null
                );`
      db.run("drop table if exists tunnels")
      db.run(stmt, resolve)
    })
  })
}

function createBusinessesTable(db) {
  return new Promise((resolve) => {
    db.serialize(() => {
      const stmt = String.raw`CREATE TABLE IF NOT EXISTS businesses (
            "id" integer primary key autoincrement,
            "b_id" text,
            "name" text not null,
            "src_port" text not null,
            "work_dest_port" text not null,
            "guard_dest_port" text not null,
            "work_tunnel" text not null,
            "guard_tunnel" text not null
          );`
      db.run("drop table if exists businesses")
      db.run(stmt, resolve)
    })
  })
}

function extractTunnels(db, file, callback) {
  const tunnelPatten = /^[是|否],[是|否]?,\d*?,.*?,\d+?,[单|双]向,/i
  const header = "导入网管*,是否反向业务*,OID,Tunnel 名称*,Tunnel ID*,业务方向*,静态 CR Tunnel参数模板*,备注,网元*,端口,标签*,Tunnel接口,绑定到Tunnel策略,下一跳,网元*,端口,标签*,反向Tunnel接口,反向下一跳,自动计算路由*,约束粒度,约束类型,约束节点,网元,入端口,入标签,出端口,出标签,下一跳,Tunnel源节点 Tunnel OAM模板名称,Tunnel宿节点Tunnel OAM模板名称,OAM反向Tunnel,Tunnel源节点 Tunnel TPOAM模板名称,Tunnel宿节点Tunnel TPOAM模板名称,导入结果"
  const stmt = db.prepare("insert into tunnels (t_id, name, src_element, src_port, dest_element, dest_port, middle_elements, middle_in_ports, middle_out_ports) values(?,?,?,?,?,?,?,?,?)")

  lineReader.eachLine(file, { separator: "\r\n", encoding: "utf8" }, async (line, last) => {
    if (tunnelPatten.test(line)) {
      parse(line, (err, output) => {
        const value = output[0]
        if (value) {
          stmt.run([value[4], value[3], value[8],
            value[9], value[14], value[15], value[23], value[24], value[26]])
        }
      })
    }
    if (last) {
      setTimeout(() => {
        stmt.finalize(callback)
      }, 5000)
    }
  })
}

function extractTunnelsPromise(db, file) {
  return new Promise((resolve, reject) => {
    extractTunnels(db, file, resolve)
  })
}

function extractBusinesses(db, file, callback) {
  const workTunnelPatten = /^[是|否],[0|1],.*?,.*?,\d*?,.*?,.*?,.+?,.*?,工作,/i
  const guardTunnelPatten = /^,{9}保护,/i
  const header = "导入网管*,是否反向业务*,OID,业务名称*,业务ID,客户名称,承载业务类型,模板名称*,保护类型*,,源站点,网元*,端口*,端口描述,子接口ID,VLAN ID,Uni Qos Policy,业务分界标签,源优先级类型,源优先级域,网元*,端口*,端口描述,子接口ID,VLAN ID,Uni Qos Policy,业务分界标签,宿优先级类型,宿优先级域,左网元*,右网元*,PW ID*,PW标签,Tunnel类型*,Tunnel 名称,PW Qos Policy,PW模板,管理PW,保护模板名称,左网元,右网元,PW ID,PW标签,Tunnel类型,Tunnel 名称,PW Qos Policy,PW模板,管理PW,保护类型,源保护组ID,宿保护组ID,备注,描述,客户业务类型,区域,定制属性1,定制属性2,Y.1731 TP OAM模板,Y.1711 OAM模板,BFD,导入结果"

  const stmt = db.prepare("insert into businesses (b_id, name, src_port, work_dest_port, guard_dest_port, work_tunnel, guard_tunnel) values(?,?,?,?,?,?,?)")
  let record = null

  lineReader.eachLine(file, { separator: "\r\n", encoding: "utf8" }, async (line, last) => {
    if (workTunnelPatten.test(line)) {
      const [value] = parseSync(line)
      assert.equal(value === undefined, false)
      console.log(record)
      assert.equal(record, null)
      record = {}
      record.b_id = value[4]
      record.name = value[3]
      record.src_port = value[12]
      record.work_dest_port = value[21]
      record.work_tunnel = value[34].split(/[\n|/]/)[0]
    } else if (guardTunnelPatten.test(line)) {
      const [value] = parseSync(line)
      assert.equal(value === undefined, false)
      assert.equal(record === null, false)

      record.guard_dest_port = value[21]
      record.guard_tunnel = value[34].split(/[\n|/]/)[0]
      await stmtRun(db, stmt, [record.b_id, record.name, record.src_port,
        record.work_dest_port, record.guard_dest_port,
        record.work_tunnel, record.guard_tunnel])
      record = null
      // db.serialize(() => {
        // stmt.run([record.b_id, record.name, record.src_port,
          // record.work_dest_port, record.guard_dest_port,
          // record.work_tunnel, record.guard_tunnel])
        // record = null
      // })
    }
    if (last) {
      setTimeout(() => {
        stmt.finalize(callback)
      }, 5000)
    }
  })
}

function extractBusinessesPromise(db, file) {
  return new Promise((resolve, reject) => {
    extractBusinesses(db, file, resolve)
  })
}

function common(workRoute, guardRoute) {
  const work = workRoute.split("\n")
  const guard = guardRoute.split("\n")
  return work.filter(route => guard.includes(route)).join("\n")
}

function mergeToOutput(business, workTunnel, guardTunnel) {
  const rows = []
  let tunnel = workTunnel
  let type = "工作"
  for (let index = 0; index < 2; index += 1) {
    const result = []
    result.push(business.name)
    result.push(type)
    result.push(`${tunnel.src_element}#${business.src_port}`)
    if (type === "工作") {
      result.push(`${tunnel.dest_element}#${business.work_dest_port}`)
    } else {
      result.push(`${tunnel.dest_element}#${business.guard_dest_port}`)
    }
    result.push(tunnel.name)
    const midElement = tunnel.middle_elements.split("\n")
    const inPorts = tunnel.middle_in_ports.split("\n")
    const outPorts = tunnel.middle_out_ports.split("\n")
    const segments = []
    const routes = []
    segments.push(`${tunnel.src_element}#${tunnel.src_port}`)
    for (let i = 0, len = inPorts.length; i < len; i += 1) {
      segments.push(`${midElement[i]}#${inPorts[i]}`)
      segments.push(`${midElement[i]}#${outPorts[i]}`)
    }
    segments.push(`${tunnel.dest_element}#${tunnel.dest_port}`)
    for (let i = 1, len = segments.length; i < len; i += 2) {
      routes.push(`${segments[i - 1]} <===> ${segments[i]}`)
    }
    result.push(routes.join("\n"))
    rows.push(result)
    tunnel = guardTunnel
    type = "保护"
  }
  const workRoute = rows[0][rows[0].length - 1]
  const guardRoute = rows[1][rows[1].length - 1]
  const inCommon = common(workRoute, guardRoute)
  rows[0].push(inCommon)
  rows[1].push(inCommon)
  return rows
}

function print(id, result) {
  if (result[0][result[0].length - 1].length > 0) {
    console.log(`☟☟☟☟☟☟☟id: ${id}☟☟☟☟☟☟☟`)
    console.log("================\nwork:")
    console.log(result[0][result[0].length - 2])
    console.log("****************\nguard:")
    console.log(result[1][result[1].length - 2])
    console.log("****************\ncommon:")
    console.log(result[0][result[0].length - 1])
    console.log("================\n")
  }
}

async function inspect(db, id) {
  const business = await get(db, `select * from businesses where id = ${id}`)
  const workTunnels = await all(db, `select * from tunnels where name = "${business.work_tunnel}"`)
  let workTunnel = null
  let guardTunnel = null
  if (workTunnels.length < 1) {
    throw new Error(`no workTunnel for business: id: ${id}`)
  } else if (workTunnels.length > 1) {
    throw new Error(`more than 1 workTunnel for business: id: ${id}`)
  } else {
    workTunnel = workTunnels[0]
  }

  const guardTunnels = await all(db, `select * from tunnels where name = "${business.guard_tunnel}"`)
  if (guardTunnels.length < 1) {
    throw new Error(`no guardTunnel for business: id: ${id}`)
  } else if (guardTunnels.length > 1) {
    throw new Error(`more than 1 guardTunnel for business id: ${id}`)
  } else {
    guardTunnel = guardTunnels[0]
  }

  const result = mergeToOutput(business, workTunnel, guardTunnel)
  print(id, result)
}

module.exports = {
  createTunnelsTable,
  extractTunnels,
  extractTunnelsPromise,
  createBusinessesTable,
  extractBusinesses,
  extractBusinessesPromise,
  get,
  mergeToOutput,
  inspect,
  test,
  close,
}
