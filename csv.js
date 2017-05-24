const fs = require("fs")
const lineReader = require("line-reader")
const parse = require("csv-parse")
const parseSync = require("csv-parse/lib/sync")
const assert = require("assert")
const jschardet = require("jschardet")
const iconv = require("iconv-lite")


function detectEncoding(file) {
  return new Promise((resolve, reject) => {
    const bufferSize = 128 * 1024
    const buffer = new Buffer(bufferSize)
    fs.open(file, "r", (err, fd) => {
      if (err) {
        console.log(err)
        reject(err)
      }
      fs.read(fd, buffer, 0, bufferSize, null, (err, bytesRead, buffer) => {
        if (err) {
          reject(err)
        }
        fs.close(fd, (err) => {
          resolve(jschardet.detect(buffer).encoding)
        })
      })
    })
  })
}
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

function finalizePromise(stmt) {
  return new Promise((resolve) => {
    setTimeout(() => {
      stmt.finalize()
      resolve()
    }, 5000)
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

function split(str) {
  if (str.indexOf("\n") >= 0) {
    const strs = str.split("\n")
    // _Reverse
    const pattern = /_R(everse|VS?)?$/i
    if (pattern.test(strs[0])) {
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
function createNonLTEBusinessesTable(db) {
  const tableName = "non_lte_businesses"
  return new Promise((resolve) => {
    db.serialize(() => {
      const stmt = String.raw`CREATE TABLE IF NOT EXISTS "${tableName}" (
            "id" integer primary key autoincrement,
            "b_id" text,
            "name" text not null,
            "src_port" text not null,
            "tunnel_name" text not null
          );`
      db.run(`drop table if exists ${tableName}`)
      db.run(stmt, resolve)
    })
  })
}
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
            "src_port" text not null,
            "work_dest_port" text not null,
            "guard_dest_port" text not null,
            "work_tunnel" text not null,
            "guard_tunnel" text not null
          );`
      db.run(`drop table if exists ${tableName}`)
      db.run(stmt, resolve)
    })
  })
}

async function extractTunnels(db, file, type, callback) {
  const tunnelPatten = /^[是|否],[是|否]?,\d*?,.*?,\d+?,[单|双]向,/i
  const header = "导入网管*,是否反向业务*,OID,Tunnel 名称*,Tunnel ID*,业务方向*,静态 CR Tunnel参数模板*,备注,网元*,端口,标签*,Tunnel接口,绑定到Tunnel策略,下一跳,网元*,端口,标签*,反向Tunnel接口,反向下一跳,自动计算路由*,约束粒度,约束类型,约束节点,网元,入端口,入标签,出端口,出标签,下一跳,Tunnel源节点 Tunnel OAM模板名称,Tunnel宿节点Tunnel OAM模板名称,OAM反向Tunnel,Tunnel源节点 Tunnel TPOAM模板名称,Tunnel宿节点Tunnel TPOAM模板名称,导入结果"
  const stmt = db.prepare(`insert into ${type}_tunnels (t_id, name, src_element, src_port, dest_element, dest_port, middle_elements, middle_in_ports, middle_out_ports) values(?,?,?,?,?,?,?,?,?)`)
  const encoding = await detectEncoding(file)
  if (encoding === null) {
    throw new Error("can not detect file's encoding")
  }

  lineReader.eachLine(file, { separator: "\r\n", encoding: "binary" }, async (raw, last) => {
    const line = iconv.decode(Buffer.from(raw, "binary"), encoding)
    if (tunnelPatten.test(line)) {
      parse(line, (err, output) => {
        const value = output[0]
        if (value) {
          stmtRun(db, stmt, [value[4], value[3], value[8],
            value[9], value[14], value[15], value[23], value[24], value[26]])
        }
      })
    }
    if (last) {
      await finalizePromise(stmt)
      callback()
    }
  })
}

function extractTunnelsPromise(db, file, type) {
  return new Promise((resolve, reject) => {
    extractTunnels(db, file, type, resolve)
  })
}

async function extractBusinesses(db, file, callback) {
  const workTunnelPatten = /^[是|否],[0|1],.*?,.*?,\d*?,.*?,.*?,.+?,.*?,工作,/i
  const guardTunnelPatten = /^,{9}保护,/i
  const header = "导入网管*,是否反向业务*,OID,业务名称*,业务ID,客户名称,承载业务类型,模板名称*,保护类型*,,源站点,网元*,端口*,端口描述,子接口ID,VLAN ID,Uni Qos Policy,业务分界标签,源优先级类型,源优先级域,网元*,端口*,端口描述,子接口ID,VLAN ID,Uni Qos Policy,业务分界标签,宿优先级类型,宿优先级域,左网元*,右网元*,PW ID*,PW标签,Tunnel类型*,Tunnel 名称,PW Qos Policy,PW模板,管理PW,保护模板名称,左网元,右网元,PW ID,PW标签,Tunnel类型,Tunnel 名称,PW Qos Policy,PW模板,管理PW,保护类型,源保护组ID,宿保护组ID,备注,描述,客户业务类型,区域,定制属性1,定制属性2,Y.1731 TP OAM模板,Y.1711 OAM模板,BFD,导入结果"

  const stmt = db.prepare("insert into lte_businesses (b_id, name, src_port, work_dest_port, guard_dest_port, work_tunnel, guard_tunnel) values(?,?,?,?,?,?,?)")
  const encoding = await detectEncoding(file)
  if (encoding === null) {
    throw new Error("can not detect file's encoding")
  }
  let record = null

  lineReader.eachLine(file, { separator: "\r\n", encoding: "binary" }, async (raw, last) => {
    const line = iconv.decode(Buffer.from(raw, "binary"), encoding)
    if (workTunnelPatten.test(line)) {
      const [value] = parseSync(line)
      assert.equal(value === undefined, false)
      assert.equal(record, null)
      record = {}
      record.b_id = value[4]
      record.name = value[3]
      record.src_port = value[12]
      record.work_dest_port = value[21]
      record.work_tunnel = split(value[34])
    } else if (guardTunnelPatten.test(line)) {
      const [value] = parseSync(line)
      assert.equal(value === undefined, false)
      assert.equal(record === null, false)

      record.guard_dest_port = value[21]
      record.guard_tunnel = split(value[34])
      await stmtRun(db, stmt, [record.b_id, record.name, record.src_port,
        record.work_dest_port, record.guard_dest_port,
        record.work_tunnel, record.guard_tunnel])
      record = null
    }
    if (last) {
      setTimeout(() => {
        stmt.finalize(callback)
      }, 5000)
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

  lineReader.eachLine(file, { separator: "\r\n", encoding: "binary" }, async (raw, last) => {
    const line = iconv.decode(Buffer.from(raw, "binary"), encoding)
    if (tunnelPatten.test(line)) {
      parse(line, (err, output) => {
        const value = output[0]
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
async function extractNonLTEBusinesses(db, file, type, callback) {
  const workTunnelPatten = /^[是|否],[0|1],.*?,.*?,\d*?,.*?,.*?,.+?,.*?,工作,/i
  // const guardTunnelPatten = /^,{9}保护,/i
  // const header = "导入网管*,是否反向业务*,OID,业务名称*,业务ID,客户名称,承载业务类型,模板名称*,保护类型*,,源站点,网元*,端口*,端口描述,子接口ID,VLAN ID,Uni Qos Policy,业务分界标签,源优先级类型,源优先级域,网元*,端口*,端口描述,子接口ID,VLAN ID,Uni Qos Policy,业务分界标签,宿优先级类型,宿优先级域,左网元*,右网元*,PW ID*,PW标签,Tunnel类型*,Tunnel 名称,PW Qos Policy,PW模板,管理PW,保护模板名称,左网元,右网元,PW ID,PW标签,Tunnel类型,Tunnel 名称,PW Qos Policy,PW模板,管理PW,保护类型,源保护组ID,宿保护组ID,备注,描述,客户业务类型,区域,定制属性1,定制属性2,Y.1731 TP OAM模板,Y.1711 OAM模板,BFD,导入结果"

  const stmt = db.prepare("insert into non_lte_businesses (b_id, name, src_port, tunnel_name) values(?,?,?,?)")
  const encoding = await detectEncoding(file)
  if (encoding === null) {
    throw new Error("can not detect file's encoding")
  }

  lineReader.eachLine(file, { separator: "\r\n", encoding: "binary" }, async (raw, last) => {
    const line = iconv.decode(Buffer.from(raw, "binary"), encoding)
    if (workTunnelPatten.test(line)) {
      parse(line, (err, output) => {
        const value = output[0]
        if (value) {
          if (type === "eth") {
            stmtRun(db, stmt, [value[4], value[3], value[12], split(value[34])])
          } else {
            stmtRun(db, stmt, [value[4], value[3], value[12], split(value[32])])
          }
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

function common(workRoute, guardRoute) {
  const work = workRoute.split("\n")
  const guard = guardRoute.split("\n")
  return work.filter(route => guard.includes(route)).join("\n")
}

function fillRow(record, type) {
  let TName
  let TSrcElement
  let TSrcPort
  let TDestElement
  let TDestPort
  let BDestPort
  let TMiddleElements
  let TMiddleInPorts
  let TMiddleOutPorts

  if (type === "工作") {
    TName = record.work_name
    TSrcElement = record.work_src_element
    TSrcPort = record.work_src_port
    TDestElement = record.work_dest_element
    TDestPort = record.work_dest_port
    BDestPort = record.b_work_desk_port
    TMiddleElements = record.work_middle_elements.split("\n")
    TMiddleInPorts = record.work_middle_in_ports.split("\n")
    TMiddleOutPorts = record.work_middle_out_ports.split("\n")
  } else {
    TName = record.guard_name
    TSrcElement = record.guard_src_element
    TSrcPort = record.guard_src_port
    TDestElement = record.guard_dest_element
    TDestPort = record.guard_dest_port
    BDestPort = record.b_guard_desk_port
    TMiddleElements = record.guard_middle_elements.split("\n")
    TMiddleInPorts = record.guard_middle_in_ports.split("\n")
    TMiddleOutPorts = record.guard_middle_out_ports.split("\n")
  }
  const result = []
  result.push(record.b_name)
  result.push(type)
  result.push(`${record.b_src_element}#${record.b_src_port}`)
  result.push(`${TDestElement}#${BDestPort}`)
  result.push(`${TName}`)
  const segments = []
  const routes = []
  segments.push(`${TSrcElement}#${TSrcPort}`)
  for (let i = 0, len = TMiddleInPorts.length; i < len; i += 1) {
    segments.push(`${TMiddleElements[i]}#${TMiddleInPorts[i]}`)
    segments.push(`${TMiddleElements[i]}#${TMiddleOutPorts[i]}`)
  }
  segments.push(`${TDestElement}#${TDestPort}`)
  for (let i = 1, len = segments.length; i < len; i += 2) {
    routes.push(`${segments[i - 1]} <===> ${segments[i]}`)
  }
  result.push(routes.join("\n"))
  return result
}

function mergeRow(row) {
  const work = fillRow(row, "工作")
  const guard = fillRow(row, "保护")
  const workRoute = work[work.length - 1]
  const guardRoute = guard[guard.length - 1]
  const inCommon = common(workRoute, guardRoute)
  work.push(inCommon)
  guard.push(inCommon)
  // if (inCommon) {
    // console.log("=================================\nrow:")
    // console.log(work)
    // console.log(guard)
    // console.log("*********************************\nwork:")
    // console.log(work[work.length - 2])
    // console.log("*********************************\nguard:")
    // console.log(guard[guard.length - 2])
    // console.log("*********************************\ncommon:")
    // console.log(inCommon)
  // }
  return [work, guard]
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
  const business = await get(db, `select * from lte_businesses where id = ${id}`)
  const workTunnels = await all(db, `select * from lte_tunnels where name = "${business.work_tunnel}"`)
  let workTunnel = null
  let guardTunnel = null
  if (workTunnels.length < 1) {
    throw new Error(`no workTunnel for business: id: ${id}, name: ${business.name}, workTunnel: ${business.work_tunnel}`)
  } else if (workTunnels.length > 1) {
    throw new Error(`more than one workTunnel for business: id: ${id}, name: ${business.name}, workTunnel: ${business.work_tunnel}`)
  } else {
    workTunnel = workTunnels[0]
  }

  const guardTunnels = await all(db, `select * from lte_tunnels where name = "${business.guard_tunnel}"`)
  if (guardTunnels.length < 1) {
    throw new Error(`no guardTunnel for business: id: ${id}, name: ${business.name}, guardTunnel: ${business.guard_tunnel}`)
  } else if (guardTunnels.length > 1) {
    throw new Error(`more than one guardTunnel for business: id: ${id}, name: ${business.name}, guardTunnel: ${business.guard_tunnel}`)
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
  createNonLTEBusinessesTable,
  createNonLTETunnelsGuardGroupTable,
  extractBusinesses,
  extractNonLTEBusinesses,
  extractBusinessesPromise,
  extractNonLTEBusinessesPromise,
  extractNonLTETunnelsGuardGroup,
  extractNonLTETunnelsGuardGroupPromise,
  get,
  mergeToOutput,
  inspect,
  test,
  close,
  mergeRow,
}
