const fs = require("fs")
const path = require("path")
const lineReader = require("line-reader")
const jschardet = require("jschardet")
const iconv = require("iconv-lite")
const { expect } = require("chai")
const papa = require("papaparse")

const lineReaderOption = {
  separator: "\r\n",
  encoding: "binary",
  bufferSize: 10240,
}

// promise
function detectEncoding(file) {
  return new Promise((resolve, reject) => {
    const bufferSize = 128 * 1024
    const buffer = new Buffer(bufferSize)
    fs.open(file, "r", (err, fd) => {
      if (err) {
        console.log(err)
        reject(err)
      }
      fs.read(fd, buffer, 0, bufferSize, null, (error) => {
        if (error) {
          reject(err)
        }
        fs.close(fd, () => {
          resolve(jschardet.detect(buffer).encoding)
        })
      })
    })
  })
}

// promise
function closeDB(db) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err)
      }
      resolve()
    })
  })
}

function finalizePromise(stmt) {
  return new Promise((resolve) => {
    setTimeout(() => {
      stmt.finalize()
      resolve()
    }, 500)
  })
}

function getAllRecords(db, sql) {
  return new Promise((resolve, reject) => {
    db.all(sql, (err, row) => {
      if (err) {
        console.log(err)
        reject(err)
      }
      resolve(row)
    })
  })
}
// promise
function getRecord(db, sql) {
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

// promise
function stmtRun(db, stmt, values) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      stmt.run(values)
      resolve()
    })
  })
}

function split(str) {
  if (str.indexOf("\n") >= 0) {
    const strs = str.split("\n")
    // _Reverse
    const pattern = /_R(everse|VS?)?$/i
    if (strs[0] === "" || pattern.test(strs[0])) {
      return strs[1]
    }
    return strs[0]
  }
  const index = str.indexOf("/")
  if (index < 0) {
    return str
  }
  // demo-L2/L3-master_RVS/demo-L2/L3-master
  // demo-L2/L3-master
  const pre = str.substring(0, index)
  const nextIndex = str.indexOf(pre, index)
  if (nextIndex < 0) {
    return str
  }
  const part1 = str.substring(0, nextIndex - 1)
  const part2 = str.substring(nextIndex)
  return part1.length < part2.length ? part1 : part2
}

// promise
function createBusinessesTable(db, type = "lte") {
  let tableName
  if (type === "lte") {
    tableName = "lte_businesses"
  } else {
    tableName = "non_lte_businesses"
  }
  return new Promise((resolve) => {
    db.serialize(() => {
      const stmt = String.raw`CREATE TABLE IF NOT EXISTS "${tableName}" (
            "id" integer primary key autoincrement,
            "b_id" text,
            "name" text not null,
            "src_element" text not null,
            "src_port" text not null,
            "work_dest_element" text not null,
            "work_dest_port" text not null,
            "guard_dest_element" text not null,
            "guard_dest_port" text not null,
            "work_tunnel" text not null,
            "guard_tunnel" text not null
          );`
      db.run(`drop table if exists ${tableName}`)
      db.run(stmt, resolve)
    })
  })
}
// promise
function createTunnelsTable(db, type = "lte") {
  let tableName
  if (type === "lte") {
    tableName = "lte_tunnels"
  } else {
    tableName = "non_lte_tunnels"
  }
  return new Promise((resolve) => {
    db.serialize(() => {
      const stmt = String.raw`CREATE TABLE IF NOT EXISTS "${tableName}" (
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
      db.run(`drop table if exists ${tableName}`)
      db.run(stmt, resolve)
    })
  })
}
// promise
function createNonLTETunnelsGuardGroupTable(db) {
  const tableName = "non_lte_tunnels_guard_group"
  return new Promise((resolve) => {
    db.serialize(() => {
      const stmt = String.raw`CREATE TABLE IF NOT EXISTS "${tableName}" (
            "id" integer primary key autoincrement,
            "name" text not null,
            "work_tunnel" text not null,
            "guard_tunnel" text not null
          );`
      db.run(`drop table if exists ${tableName}`)
      db.run(stmt, resolve)
    })
  })
}
// promise
function createNonLTEBusinessesTable(db) {
  const tableName = "non_lte_businesses"
  return new Promise((resolve) => {
    db.serialize(() => {
      const stmt = String.raw`CREATE TABLE IF NOT EXISTS "${tableName}" (
            "id" integer primary key autoincrement,
            "b_id" text,
            "name" text not null,
            "src_element" text not null,
            "src_port" text not null,
            "dest_element" text not null,
            "dest_port" text not null,
            "tunnel_name" text not null
          );`
      db.run(`drop table if exists ${tableName}`)
      db.run(stmt, resolve)
    })
  })
}

async function extractTunnels(db, file, type, callback) {
  const tunnelPatten = /^[是|否],[是|否]?,\d*?,.*?,\d+?,[单|双]向,/i
  // const header = "导入网管*,是否反向业务*,OID,Tunnel 名称*,Tunnel ID*,业务方向*,静态 CR Tunnel参数模板*,备注,网元*,端口,标签*,Tunnel接口,绑定到Tunnel策略,下一跳,网元*,端口,标签*,反向Tunnel接口,反向下一跳,自动计算路由*,约束粒度,约束类型,约束节点,网元,入端口,入标签,出端口,出标签,下一跳,Tunnel源节点 Tunnel OAM模板名称,Tunnel宿节点Tunnel OAM模板名称,OAM反向Tunnel,Tunnel源节点 Tunnel TPOAM模板名称,Tunnel宿节点Tunnel TPOAM模板名称,导入结果"
  let tableName
  if (type === "lte") {
    tableName = "lte_tunnels"
  } else if (type === "nonlte" || type === "non_lte") {
    tableName = "non_lte_tunnels"
  } else {
    throw new Error(`unsupport tunnel type: ${type}`)
  }
  const stmt = db.prepare(`insert into ${tableName} (t_id, name, src_element, src_port, dest_element, dest_port, middle_elements, middle_in_ports, middle_out_ports) values(?,?,?,?,?,?,?,?,?)`)
  const encoding = await detectEncoding(file)
  if (encoding === null) {
    throw new Error("can not detect file's encoding")
  }

  let recordCounter = 0
  db.run("begin transaction")
  lineReader.eachLine(file, lineReaderOption, async (raw, last) => {
    const line = iconv.decode(Buffer.from(raw, "binary"), encoding)
    if (tunnelPatten.test(line)) {
      const value = papa.parse(line).data[0]
      if (value) {
        stmtRun(db, stmt, [value[4], value[3], value[8],
          value[9], value[14], value[15], value[23], value[24], value[26]])
        recordCounter += 1
      }
    }
    if (last) {
      await finalizePromise(stmt)
      db.run("commit")
      callback(recordCounter)
    }
  })
}

function extractTunnelsPromise(db, file, type) {
  return new Promise((resolve, reject) => {
    extractTunnels(db, file, type, resolve)
  })
}
function insertPairLineToDB(stmt, pair) {
  // record = {}
  // record.b_id = value[4]
  // record.name = value[3]
  // record.src_element = value[11]
  // record.src_port = value[12]
  // record.work_dest_element = value[20]
  // record.work_dest_port = value[21]
  // record.work_tunnel = split(value[34])
  // NEW LINE: guard
  // record.guard_dest_element = value[20] // todo
  // record.guard_dest_port = value[21]
  // record.guard_tunnel = split(value[34])
  // await stmtRun(db, stmt, [
  // record.b_id, record.name, record.src_element, record.src_port,
  // record.work_dest_element, record.work_dest_port,
  // record.guard_dest_element, record.guard_dest_port,
  // record.work_tunnel, record.guard_tunnel,
  // ])
  const [work] = papa.parse(pair[0], { delimiter: "," }).data
  const [guard] = papa.parse(pair[1], { delimiter: "," }).data
  stmt.run(work[4], work[3], work[11], work[12],
    work[20], work[21],
    guard[20], guard[21],
    split(work[34]), split(guard[34]))
}

async function extractBusinesses(db, file, callback) {
  const workTunnelPatten = /^[是|否],[0|1],.*?,.*?,\d*?,.*?,.*?,.+?,.*?,工作,/i
  const guardTunnelPatten = /^,{9}保护,/i
  // const header = "导入网管*,是否反向业务*,OID,业务名称*,业务ID,客户名称,承载业务类型,模板名称*,保护类型*,,源站点,网元*,端口*,端口描述,子接口ID,VLAN ID,Uni Qos Policy,业务分界标签,源优先级类型,源优先级域,网元*,端口*,端口描述,子接口ID,VLAN ID,Uni Qos Policy,业务分界标签,宿优先级类型,宿优先级域,左网元*,右网元*,PW ID*,PW标签,Tunnel类型*,Tunnel 名称,PW Qos Policy,PW模板,管理PW,保护模板名称,左网元,右网元,PW ID,PW标签,Tunnel类型,Tunnel 名称,PW Qos Policy,PW模板,管理PW,保护类型,源保护组ID,宿保护组ID,备注,描述,客户业务类型,区域,定制属性1,定制属性2,Y.1731 TP OAM模板,Y.1711 OAM模板,BFD,导入结果"

  const stmt = db.prepare("insert into lte_businesses (b_id, name, src_element, src_port, work_dest_element, work_dest_port, guard_dest_element, guard_dest_port, work_tunnel, guard_tunnel) values(?,?,?,?,?,?,?,?,?,?)")
  const encoding = await detectEncoding(file)
  if (encoding === null) {
    throw new Error("can not detect file's encoding")
  }
  let recordCounter = 0
  const pair = []

  db.run("begin transaction")
  lineReader.eachLine(file, lineReaderOption, async (raw, last) => {
    const line = iconv.decode(Buffer.from(raw, "binary"), encoding)
    if (workTunnelPatten.test(line)) {
      expect(pair.length).to.be.equal(0)
      pair.push(line)
    } else if (guardTunnelPatten.test(line)) {
      expect(pair.length).to.be.equal(1)
      pair.push(line)
      insertPairLineToDB(stmt, pair)
      recordCounter += 1
      pair.length = 0
    }
    if (last) {
      await finalizePromise(stmt)
      db.run("commit")
      callback(recordCounter)
    }
  })
}

async function extractNonLTETunnelsGuardGroup(db, file, callback) {
  const tunnelPatten = /^[是|否],\d*,.*?,/i
  // const guardTunnelPatten = /^,{9}保护,/i
  // const header = "导入网管*,是否反向业务*,OID,业务名称*,业务ID,客户名称,承载业务类型,模板名称*,保护类型*,,源站点,网元*,端口*,端口描述,子接口ID,VLAN ID,Uni Qos Policy,业务分界标签,源优先级类型,源优先级域,网元*,端口*,端口描述,子接口ID,VLAN ID,Uni Qos Policy,业务分界标签,宿优先级类型,宿优先级域,左网元*,右网元*,PW ID*,PW标签,Tunnel类型*,Tunnel 名称,PW Qos Policy,PW模板,管理PW,保护模板名称,左网元,右网元,PW ID,PW标签,Tunnel类型,Tunnel 名称,PW Qos Policy,PW模板,管理PW,保护类型,源保护组ID,宿保护组ID,备注,描述,客户业务类型,区域,定制属性1,定制属性2,Y.1731 TP OAM模板,Y.1711 OAM模板,BFD,导入结果"

  const stmt = db.prepare("insert into non_lte_tunnels_guard_group (name, work_tunnel, guard_tunnel) values(?,?,?)")
  const encoding = await detectEncoding(file)
  if (encoding === null) {
    throw new Error("can not detect file's encoding")
  }

  let recordCounter = 0
  db.run("begin transaction")
  lineReader.eachLine(file, lineReaderOption, async (raw, last) => {
    const line = iconv.decode(Buffer.from(raw, "binary"), encoding)
    if (tunnelPatten.test(line)) {
      const value = papa.parse(line).data[0]
      if (value) {
        const name = value[2]
        const role = value[7].split("\n")
        const tunnels = value[8].split("\n")
        let workTunnel
        let guardTunnel
        if (role.length === 2) {
          workTunnel = tunnels[role.indexOf("工作")]
          guardTunnel = tunnels[role.indexOf("保护")]
        } else {
          const pattern = /_RVS.*$|_RV$|_R$|_Reverse$/i
          const tmp = tunnels.filter(tunnel => !pattern.test(tunnel))

          const guardPattern = /_PRT$|_PR$|_P$|-P$/i
          tmp.forEach((tunnel) => {
            if (guardPattern.test(tunnel)) {
              guardTunnel = tunnel
            } else {
              workTunnel = tunnel
            }
          })
          if (workTunnel === undefined) {
            // console.log(value)
            const strictGuardPattern = /_PRT$|_PR$|_P$/i
            tmp.forEach((tunnel) => {
              if (!strictGuardPattern.test(tunnel)) {
                workTunnel = tunnel
              }
            })
          }
          if (guardTunnel === undefined) {
            guardTunnel = workTunnel
          }
        }
        stmtRun(db, stmt, [name, workTunnel, guardTunnel])
        recordCounter += 1
      }
      // })
    }
    if (last) {
      await finalizePromise(stmt)
      db.run("commit")
      callback(recordCounter)
    }
  })
}

async function extractNonLTEBusinesses(db, file, type, callback) {
  const workTunnelPatten = /^[是|否],[0|1],.*?,.*?,\d*?,.*?,.*?,.*?,.*?,工作,/i
  // const guardTunnelPatten = /^,{9}保护,/i
  // const header = "导入网管*,是否反向业务*,OID,业务名称*,业务ID,客户名称,承载业务类型,模板名称*,保护类型*,,源站点,网元*,端口*,端口描述,子接口ID,VLAN ID,Uni Qos Policy,业务分界标签,源优先级类型,源优先级域,网元*,端口*,端口描述,子接口ID,VLAN ID,Uni Qos Policy,业务分界标签,宿优先级类型,宿优先级域,左网元*,右网元*,PW ID*,PW标签,Tunnel类型*,Tunnel 名称,PW Qos Policy,PW模板,管理PW,保护模板名称,左网元,右网元,PW ID,PW标签,Tunnel类型,Tunnel 名称,PW Qos Policy,PW模板,管理PW,保护类型,源保护组ID,宿保护组ID,备注,描述,客户业务类型,区域,定制属性1,定制属性2,Y.1731 TP OAM模板,Y.1711 OAM模板,BFD,导入结果"

  const stmt = db.prepare("insert into non_lte_businesses (b_id, name, src_element, src_port, dest_element, dest_port, tunnel_name) values(?,?,?,?,?,?,?)")
  const encoding = await detectEncoding(file)
  if (encoding === null) {
    throw new Error("can not detect file's encoding")
  }

  let recordCounter = 0
  db.run("begin transaction")
  lineReader.eachLine(file, lineReaderOption, async (raw, last) => {
    const line = iconv.decode(Buffer.from(raw, "binary"), encoding)
    if (workTunnelPatten.test(line)) {
      const value = papa.parse(line).data[0]
      if (value) {
        if (type === "eth") {
          stmtRun(db, stmt, [value[4], value[3], value[11],
            value[12], value[20], value[21], split(value[34])])
        } else {
          stmtRun(db, stmt, [value[4], value[3], value[11],
            value[12], value[19], value[20], split(value[32])])
        }
      }
      recordCounter += 1
    }
    if (last) {
      await finalizePromise(stmt)
      db.run("commit")
      callback(recordCounter)
    }
  })
}

function extractBusinessesPromise(db, file) {
  return new Promise((resolve, reject) => {
    extractBusinesses(db, file, resolve)
  })
}
function extractNonLTEBusinessesPromise(db, file, type) {
  return new Promise((resolve, reject) => {
    extractNonLTEBusinesses(db, file, type, resolve)
  })
}
function extractNonLTETunnelsGuardGroupPromise(db, file) {
  return new Promise((resolve, reject) => {
    extractNonLTETunnelsGuardGroup(db, file, resolve)
  })
}

// workRoute, guardRoute result: String
function common(workRoute, guardRoute) {
  let work
  if (workRoute === "查无此Tunnel" || workRoute === "查无保护组") {
    work = []
  } else {
    work = workRoute.split("\n")
  }
  const guard = guardRoute.split("\n")
  return work.filter(route => guard.includes(route)).join("\n")
}

function sqlRowToCSVRow(record, type) {
  let BDestElement
  let BDestPort
  // 从业务表里提取出的隧道名称
  let TName
  // 从 Tunnel 表里提取的隧道名称. 如果该名称为空, 说明找不到对应的 Tunnel
  let TTName
  let TSrcElement
  let TSrcPort
  let TDestElement
  let TDestPort
  let TMiddleElements
  let TMiddleInPorts
  let TMiddleOutPorts
  let businessType

  if (record.hasOwnProperty("gg_name")) {
    businessType = "non-lte"
  } else {
    businessType = "lte"
  }
  if (type === "工作") {
    BDestElement = record.b_work_dest_element
    BDestPort = record.b_work_dest_port
    TName = record.work_name
    TTName = record.work_tunnel_name
    TSrcElement = record.work_src_element
    TSrcPort = record.work_src_port
    TDestElement = record.work_dest_element
    TDestPort = record.work_dest_port
    TMiddleElements = record.work_middle_elements ? record.work_middle_elements.split("\n") : []
    TMiddleInPorts = record.work_middle_in_ports ? record.work_middle_in_ports.split("\n") : []
    TMiddleOutPorts = record.work_middle_out_ports ? record.work_middle_out_ports.split("\n") : []
  } else {
    BDestElement = record.b_guard_dest_element
    BDestPort = record.b_guard_dest_port
    TName = record.guard_name
    TTName = record.guard_tunnel_name
    TSrcElement = record.guard_src_element
    TSrcPort = record.guard_src_port
    TDestElement = record.guard_dest_element
    TDestPort = record.guard_dest_port
    TMiddleElements = record.guard_middle_elements ? record.guard_middle_elements.split("\n") : []
    TMiddleInPorts = record.guard_middle_in_ports ? record.guard_middle_in_ports.split("\n") : []
    TMiddleOutPorts = record.guard_middle_out_ports ? record.guard_middle_out_ports.split("\n") : []
  }
  const result = []
  result.push(record.b_name)
  result.push(type)
  result.push(`${record.b_src_element}-${record.b_src_port}`)
  if (!TName || TName === "null") {
    TName = ""
  }
  if (!TName) {
    result.push("")
  } else {
    result.push(`${BDestElement}-${BDestPort}`)
  }
  result.push(`${TName}`)
  if (businessType === "non-lte" && (!record.gg_name || record.gg_name === "null")) {
    result.push("查无保护组")
  } else if (businessType === "lte" && (!TTName || TTName === "null")) {
    result.push("查无此Tunnel")
  } else {
    const segments = []
    const routes = []
    segments.push(`${TSrcElement}-${TSrcPort}`)
    if (TMiddleElements.length === TMiddleInPorts.length
      && TMiddleElements.length === TMiddleOutPorts.length) {
      for (let i = 0, len = TMiddleInPorts.length; i < len; i += 1) {
        segments.push(`${TMiddleElements[i]}-${TMiddleInPorts[i]}`)
        segments.push(`${TMiddleElements[i]}-${TMiddleOutPorts[i]}`)
      }
      segments.push(`${TDestElement}-${TDestPort}`)
      for (let i = 1, len = segments.length; i < len; i += 2) {
        routes.push(`${segments[i - 1]}___${segments[i]}`)
      }
      result.push(routes.join("\n"))
    } else {
      console.log(TMiddleElements)
      result.push("")
    }
  }
  return result
}

function sqlRowToCSVRows(row) {
  const work = sqlRowToCSVRow(row, "工作")
  const guard = sqlRowToCSVRow(row, "保护")
  const workRoute = work[work.length - 1]
  const guardRoute = guard[guard.length - 1]
  const inCommon = common(workRoute, guardRoute)
  work.push(inCommon)
  guard.push(inCommon)
  return [work, guard]
}

function writeCSVHeader(ws, encoding) {
  const header = [["业务名称", "保护形式", "源网元信息", "宿网元信息", "承载Tunnel名称", "承载Tunnel路由", "同路由部分"]]

  const out = `${papa.unparse(header, { header: false })}\r\n`
  if (encoding === "utf8") {
    ws.write(new Buffer("\xEF\xBB\xBF", "binary"))
    ws.write(out)
  } else {
    ws.write(iconv.encode(out, encoding))
  }
}
function exportToCSV(db, file, type, exportAll, pagination, encoding = "utf8", callback) {
  const view = type === "lte" ? "lte_common_route_view" : "non_lte_common_route_view"
  const sql = `select * from ${view}`

  let writeOutCounter = 0
  let page = 1
  const dirname = path.dirname(file)
  const basename = path.basename(file, ".csv")
  const encodingLowerCase = encoding.toLowerCase()

  let ws = fs.createWriteStream(path.join(dirname, `${basename}-${page}.csv`))
  writeCSVHeader(ws, encodingLowerCase)
  db.each(sql, (err, row) => {
    const result = sqlRowToCSVRows(row)
    if (exportAll || result[0][result[0].length - 1]) {
      const out = `${papa.unparse(result, { header: false })}\r\n\r\n`
      if (encodingLowerCase === "utf8") {
        ws.write(out)
      } else {
        ws.write(iconv.encode(out, encoding))
      }
      writeOutCounter += 1
      if (pagination && writeOutCounter % pagination === 0) {
        ws.end()
        page += 1
        ws = fs.createWriteStream(path.join(dirname, `${basename}-${page}.csv`))
        writeCSVHeader(ws, encodingLowerCase)
      }
    }
  }, (error, total) => {
    ws.end()
    if (typeof callback === "function") {
      callback(writeOutCounter)
    }
  })
}

// promise
function extractFile(db, file, type) {
  switch (type) {
  case "lteb":
    return extractBusinessesPromise(db, file)
  case "ltet":
    return extractTunnelsPromise(db, file, "lte")
  case "non-ltet":
    return extractTunnelsPromise(db, file, "nonlte")
  case "ces":
    return extractNonLTEBusinessesPromise(db, file, "ces")
  case "eth":
    return extractNonLTEBusinessesPromise(db, file, "eth")
  case "guard-group":
    return extractNonLTETunnelsGuardGroupPromise(db, file)
  default:
    throw new Error("unsupport file")
  }
}

// promise
function createLTECommonRouteView(db) {
  const sql = String.raw`
      create view lte_common_route_view as
      select
      b.name as b_name,
      b.src_element as b_src_element,
      b.src_port as b_src_port,
      b.work_dest_element as b_work_dest_element,
      b.work_dest_port as b_work_dest_port,
      b.guard_dest_element as b_guard_dest_element,
      b.guard_dest_port as b_guard_dest_port,
      b.work_tunnel as work_name,
      w.name as work_tunnel_name,
      w.src_element as work_src_element,
      w.src_port as work_src_port,
      w.dest_element as work_dest_element,
      w.dest_port as work_dest_port,
      w.middle_elements as work_middle_elements,
      w.middle_in_ports as work_middle_in_ports,
      w.middle_out_ports as work_middle_out_ports,
      b.guard_tunnel as guard_name,
      g.name as guard_tunnel_name,
      g.src_element as guard_src_element,
      g.src_port as guard_src_port,
      g.dest_element as guard_dest_element,
      g.dest_port as guard_dest_port,
      g.middle_elements as guard_middle_elements,
      g.middle_in_ports as guard_middle_in_ports,
      g.middle_out_ports as guard_middle_out_ports
      from lte_businesses as b
      left join lte_tunnels as w
        on b.work_tunnel = w.name
      left join lte_tunnels as g
        on b.guard_tunnel = g.name
      `
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("drop view if exists lte_common_route_view")
      db.run(sql, resolve)
    })
  })
}

// promise
function createNonLTEBTView(db) {
  const sql = String.raw`
    create view non_lte_b_t_view as
    select
    b.name as name,
    b.src_element as src_element,
    b.src_port as src_port,
    b.dest_element as work_dest_element,
    b.dest_port as work_dest_port,
    b.tunnel_name as work_tunnel,
    t.guard_tunnel as guard_tunnel,
    t.name as gg_name
    from non_lte_businesses as b
    left join non_lte_tunnels_guard_group as t
      on b.tunnel_name = t.work_tunnel
    `
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("drop view if exists non_lte_b_t_view")
      db.run(sql, resolve)
    })
  })
}
// promise
function createNonLTECommonRouteView(db) {
  const sql = String.raw`
    create view non_lte_common_route_view as
    select
    temp.name as b_name,
    temp.src_element as b_src_element,
    temp.src_port as b_src_port,
    temp.work_dest_element as b_work_dest_element,
    temp.work_dest_port as b_work_dest_port,
    guard.dest_element as b_guard_dest_element,
    guard.dest_port as b_guard_dest_port,
    temp.work_tunnel as work_name,
    work.src_element as work_src_element,
    work.src_port as work_src_port,
    work.dest_element as work_dest_element,
    work.dest_port as work_dest_port,
    work.middle_elements as work_middle_elements,
    work.middle_in_ports as work_middle_in_ports,
    work.middle_out_ports as work_middle_out_ports,
    temp.guard_tunnel as guard_name,
    guard.src_element as guard_src_element,
    guard.src_port as guard_src_port,
    guard.dest_element as guard_dest_element,
    guard.dest_port as guard_dest_port,
    guard.middle_elements as guard_middle_elements,
    guard.middle_in_ports as guard_middle_in_ports,
    guard.middle_out_ports as guard_middle_out_ports,
    temp.gg_name as gg_name
    from non_lte_b_t_view as temp
    left join non_lte_tunnels as work
      on temp.work_tunnel = work.name
    left join non_lte_tunnels as guard
      on temp.guard_tunnel = guard.name
    `
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run("drop view if exists non_lte_common_route_view")
      db.run(sql, resolve)
    })
  })
}

// promise
function createTables(db) {
  return Promise.all([
    createTunnelsTable(db, "lte"),
    createBusinessesTable(db),
    createTunnelsTable(db, "non_lte"),
    createNonLTEBusinessesTable(db),
    createNonLTETunnelsGuardGroupTable(db),
  ]).then(() => {
    const promises = Promise.all([
      createLTECommonRouteView(db),
      createNonLTEBTView(db),
    ])
    return promises
  }).then(() => createNonLTECommonRouteView(db))
}

async function queryBusiness(db, name) {
  const stmt = db.prepare("select * from non_lte_common_route_view where b_name = ? union select * from lte_common_route_view where b_name = ?")
  const rows = await getAllRecords(stmt, [name, name])
  return rows.map(row => sqlRowToCSVRows(row))
}

module.exports = {
  createTables,
  extractFile,
  getRecord,
  closeDB,
  queryBusiness,
  exportToCSV,
}
