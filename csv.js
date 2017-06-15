const fs = require('fs')
const path = require('path')
const lineReader = require('line-reader')
const jschardet = require('jschardet')
const iconv = require('iconv-lite')
const { expect } = require('chai')
const papa = require('papaparse')

const lineReaderOption = {
  separator: '\r\n',
  encoding: 'binary',
  bufferSize: 10240
}

// promise
function detectEncoding (file) {
  return new Promise((resolve, reject) => {
    const bufferSize = 128 * 1024
    const buffer = Buffer.alloc(bufferSize)
    fs.open(file, 'r', (err, fd) => {
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
function closeDB (db) {
  return new Promise((resolve, reject) => {
    db.close((err) => {
      if (err) {
        reject(err)
      }
      resolve()
    })
  })
}

function finalizePromise (stmt) {
  return new Promise((resolve) => {
    setTimeout(() => {
      stmt.finalize()
      resolve()
    }, 100)
  })
}

function getAllRecords (db, sql) {
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
function getRecord (stmt, para) {
  if (para) {
    return new Promise((resolve, reject) => {
      stmt.get(para, (err, row) => {
        if (err) {
          console.log(err)
          reject(err)
        }
        resolve(row)
      })
    })
  } else {
    return new Promise((resolve, reject) => {
      stmt.get((err, row) => {
        if (err) {
          console.log(err)
          reject(err)
        }
        resolve(row)
      })
    })
  }
}

// promise
function stmtRun (db, stmt, values) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      stmt.run(values)
      resolve()
    })
  })
}

function split (str) {
  if (str.indexOf('\n') >= 0) {
    const strs = str.split('\n')
    // _Reverse
    const pattern = /_R(everse|VS?)?$/i
    if (strs[0] === '' || pattern.test(strs[0])) {
      return strs[1]
    }
    return strs[0]
  }
  const index = str.indexOf('/')
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
function createBusinessesTable (db, type = 'lte') {
  const tableName = type === 'lte' ? 'lte_businesses' : 'non_lte_businesses'
  return new Promise((resolve) => {
    const stmt = String.raw`
      drop table if exists ${tableName};
      CREATE TABLE IF NOT EXISTS "${tableName}" (
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
    db.exec(stmt, resolve)
  })
}
// promise
function createTunnelsTable (db, type = 'lte') {
  const tableName = type === 'lte' ? 'lte_tunnels' : 'non_lte_tunnels'
  return new Promise((resolve) => {
    const stmt = String.raw`
      drop table if exists ${tableName};
      CREATE TABLE IF NOT EXISTS "${tableName}" (
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
    db.exec(stmt, resolve)
  })
}
// promise
function createNonLTETunnelsGuardGroupTable (db) {
  const tableName = 'non_lte_tunnels_guard_group'
  return new Promise((resolve) => {
    const stmt = String.raw`
      drop table if exists ${tableName};
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        "id" integer primary key autoincrement,
        "name" text not null,
        "work_tunnel" text not null,
        "guard_tunnel" text not null
      );`
    db.exec(stmt, resolve)
  })
}
function createPhysicalTunnelsTable (db) {
  const tableName = 'physical_tunnels'
  return new Promise((resolve) => {
    const stmt = String.raw`
      drop table if exists ${tableName};
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        "id" integer primary key autoincrement,
        "name" text not null,
        "elements" text not null
      );`
    db.exec(stmt, resolve)
  })
}
// promise
function createNonLTEBusinessesTable (db) {
  const tableName = 'non_lte_businesses'
  return new Promise((resolve) => {
    const stmt = String.raw`
      drop table if exists ${tableName};
      CREATE TABLE IF NOT EXISTS "${tableName}" (
        "id" integer primary key autoincrement,
        "b_id" text,
        "name" text not null,
        "src_element" text not null,
        "src_port" text not null,
        "dest_element" text not null,
        "dest_port" text not null,
        "tunnel_name" text not null
      );`
    db.exec(stmt, resolve)
  })
}

async function extractTunnels (db, file, type, callback) {
  const tunnelPatten = /^[是|否],[是|否]?,\d*?,.*?,\d+?,[单|双]向,/i
  // const header = "导入网管*,是否反向业务*,OID,Tunnel 名称*,Tunnel ID*,业务方向*,静态 CR Tunnel参数模板*,备注,网元*,端口,标签*,Tunnel接口,绑定到Tunnel策略,下一跳,网元*,端口,标签*,反向Tunnel接口,反向下一跳,自动计算路由*,约束粒度,约束类型,约束节点,网元,入端口,入标签,出端口,出标签,下一跳,Tunnel源节点 Tunnel OAM模板名称,Tunnel宿节点Tunnel OAM模板名称,OAM反向Tunnel,Tunnel源节点 Tunnel TPOAM模板名称,Tunnel宿节点Tunnel TPOAM模板名称,导入结果"
  let tableName
  if (type === 'lte') {
    tableName = 'lte_tunnels'
  } else if (type === 'nonlte' || type === 'non_lte') {
    tableName = 'non_lte_tunnels'
  } else {
    throw new Error(`unsupport tunnel type: ${type}`)
  }
  const stmt = db.prepare(`insert into ${tableName} (t_id, name, src_element, src_port, dest_element, dest_port, middle_elements, middle_in_ports, middle_out_ports) values(?,?,?,?,?,?,?,?,?)`)
  const encoding = await detectEncoding(file)
  if (encoding === null) {
    throw new Error("can not detect file's encoding")
  }

  let recordCounter = 0
  db.run('begin transaction')
  lineReader.eachLine(file, lineReaderOption, async (raw, last) => {
    const line = iconv.decode(Buffer.from(raw, 'binary'), encoding)
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
      db.run('commit')
      callback(recordCounter)
    }
  })
}

function extractTunnelsPromise (db, file, type) {
  return new Promise((resolve, reject) => {
    extractTunnels(db, file, type, resolve)
  })
}
function insertPairLineToDB (stmt, pair) {
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
  const [work] = papa.parse(pair[0], { delimiter: ',' }).data
  const [guard] = papa.parse(pair[1], { delimiter: ',' }).data
  stmt.run(work[4], work[3], work[11], work[12],
    work[20], work[21],
    guard[20], guard[21],
    split(work[34]), split(guard[34]))
}

async function extractBusinesses (db, file, callback) {
  const workTunnelPatten = /^[是|否],[0|1],.*?,.*?,\d*?,.*?,.*?,.+?,.*?,工作,/i
  const guardTunnelPatten = /^,{9}保护,/i
  // const header = "导入网管*,是否反向业务*,OID,业务名称*,业务ID,客户名称,承载业务类型,模板名称*,保护类型*,,源站点,网元*,端口*,端口描述,子接口ID,VLAN ID,Uni Qos Policy,业务分界标签,源优先级类型,源优先级域,网元*,端口*,端口描述,子接口ID,VLAN ID,Uni Qos Policy,业务分界标签,宿优先级类型,宿优先级域,左网元*,右网元*,PW ID*,PW标签,Tunnel类型*,Tunnel 名称,PW Qos Policy,PW模板,管理PW,保护模板名称,左网元,右网元,PW ID,PW标签,Tunnel类型,Tunnel 名称,PW Qos Policy,PW模板,管理PW,保护类型,源保护组ID,宿保护组ID,备注,描述,客户业务类型,区域,定制属性1,定制属性2,Y.1731 TP OAM模板,Y.1711 OAM模板,BFD,导入结果"

  const stmt = db.prepare('insert into lte_businesses (b_id, name, src_element, src_port, work_dest_element, work_dest_port, guard_dest_element, guard_dest_port, work_tunnel, guard_tunnel) values(?,?,?,?,?,?,?,?,?,?)')
  const encoding = await detectEncoding(file)
  if (encoding === null) {
    throw new Error("can not detect file's encoding")
  }
  let recordCounter = 0
  const pair = []

  db.run('begin transaction')
  lineReader.eachLine(file, lineReaderOption, async (raw, last) => {
    const line = iconv.decode(Buffer.from(raw, 'binary'), encoding)
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
      db.run('commit')
      callback(recordCounter)
    }
  })
}

async function extractNonLTETunnelsGuardGroup (db, file, callback) {
  const tunnelPatten = /^[是|否],\d*,.*?,/i
  // const guardTunnelPatten = /^,{9}保护,/i
  // const header = "导入网管*,是否反向业务*,OID,业务名称*,业务ID,客户名称,承载业务类型,模板名称*,保护类型*,,源站点,网元*,端口*,端口描述,子接口ID,VLAN ID,Uni Qos Policy,业务分界标签,源优先级类型,源优先级域,网元*,端口*,端口描述,子接口ID,VLAN ID,Uni Qos Policy,业务分界标签,宿优先级类型,宿优先级域,左网元*,右网元*,PW ID*,PW标签,Tunnel类型*,Tunnel 名称,PW Qos Policy,PW模板,管理PW,保护模板名称,左网元,右网元,PW ID,PW标签,Tunnel类型,Tunnel 名称,PW Qos Policy,PW模板,管理PW,保护类型,源保护组ID,宿保护组ID,备注,描述,客户业务类型,区域,定制属性1,定制属性2,Y.1731 TP OAM模板,Y.1711 OAM模板,BFD,导入结果"

  const stmt = db.prepare('insert into non_lte_tunnels_guard_group (name, work_tunnel, guard_tunnel) values(?,?,?)')
  const encoding = await detectEncoding(file)
  if (encoding === null) {
    throw new Error("can not detect file's encoding")
  }

  let recordCounter = 0
  db.run('begin transaction')
  lineReader.eachLine(file, lineReaderOption, async (raw, last) => {
    const line = iconv.decode(Buffer.from(raw, 'binary'), encoding)
    if (tunnelPatten.test(line)) {
      const value = papa.parse(line).data[0]
      if (value) {
        const name = value[2]
        const role = value[7].split('\n')
        const tunnels = value[8].split('\n')
        let workTunnel
        let guardTunnel
        if (role.length === 2) {
          workTunnel = tunnels[role.indexOf('工作')]
          guardTunnel = tunnels[role.indexOf('保护')]
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
      db.run('commit')
      callback(recordCounter)
    }
  })
}

async function extractPhysicalTunnel (db, file, callback) {
  const stmt = db.prepare('insert into physical_tunnels (name, elements) values(?,?)')
  const encoding = await detectEncoding(file)
  if (encoding === null) {
    throw new Error("can not detect file's encoding")
  }

  let recordCounter = 0
  let firstLine = true
  db.run('begin transaction')
  lineReader.eachLine(file, lineReaderOption, async (raw, last) => {
    const line = iconv.decode(Buffer.from(raw, 'binary'), encoding)
    if (firstLine) {
      if (/^光路名称,承载光缆,+$/.test(line)) {
        firstLine = false
      }
    } else {
      const value = papa.parse(line).data[0]
      if (value) {
        const elements = []
        for (let i = 1; i < value.length; i += 1) {
          if (value[i]) {
            elements.push(value[i])
          }
        }
        stmtRun(db, stmt, [value[0], elements.join('\n')])
        recordCounter += 1
      }
    }
    if (last) {
      await finalizePromise(stmt)
      db.run('commit')
      callback(recordCounter)
    }
  })
}

async function extractNonLTEBusinesses (db, file, type, callback) {
  const workTunnelPatten = /^[是|否],[0|1],.*?,.*?,\d*?,.*?,.*?,.*?,.*?,工作,/i
  // const guardTunnelPatten = /^,{9}保护,/i
  // const header = "导入网管*,是否反向业务*,OID,业务名称*,业务ID,客户名称,承载业务类型,模板名称*,保护类型*,,源站点,网元*,端口*,端口描述,子接口ID,VLAN ID,Uni Qos Policy,业务分界标签,源优先级类型,源优先级域,网元*,端口*,端口描述,子接口ID,VLAN ID,Uni Qos Policy,业务分界标签,宿优先级类型,宿优先级域,左网元*,右网元*,PW ID*,PW标签,Tunnel类型*,Tunnel 名称,PW Qos Policy,PW模板,管理PW,保护模板名称,左网元,右网元,PW ID,PW标签,Tunnel类型,Tunnel 名称,PW Qos Policy,PW模板,管理PW,保护类型,源保护组ID,宿保护组ID,备注,描述,客户业务类型,区域,定制属性1,定制属性2,Y.1731 TP OAM模板,Y.1711 OAM模板,BFD,导入结果"

  const stmt = db.prepare('insert into non_lte_businesses (b_id, name, src_element, src_port, dest_element, dest_port, tunnel_name) values(?,?,?,?,?,?,?)')
  const encoding = await detectEncoding(file)
  if (encoding === null) {
    throw new Error("can not detect file's encoding")
  }

  let recordCounter = 0
  db.run('begin transaction')
  lineReader.eachLine(file, lineReaderOption, async (raw, last) => {
    const line = iconv.decode(Buffer.from(raw, 'binary'), encoding)
    if (workTunnelPatten.test(line)) {
      const value = papa.parse(line).data[0]
      if (value) {
        if (type === 'eth') {
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
      db.run('commit')
      callback(recordCounter)
    }
  })
}

function extractBusinessesPromise (db, file) {
  return new Promise((resolve, reject) => {
    extractBusinesses(db, file, resolve)
  })
}
function extractNonLTEBusinessesPromise (db, file, type) {
  return new Promise((resolve, reject) => {
    extractNonLTEBusinesses(db, file, type, resolve)
  })
}
function extractNonLTETunnelsGuardGroupPromise (db, file) {
  return new Promise((resolve, reject) => {
    extractNonLTETunnelsGuardGroup(db, file, resolve)
  })
}
function extractPhysicalTunnelPromise (db, file) {
  return new Promise((resolve, reject) => {
    extractPhysicalTunnel(db, file, resolve)
  })
}

// workRoute, guardRoute result: String
function commonLogicalTunnel (workRoute, guardRoute) {
  let emptyTunnle = false
  ;[workRoute, guardRoute].forEach((route) => {
    if (route === '查无此Tunnel' || route === '查无保护组') {
      emptyTunnle = true
    }
  })
  if (emptyTunnle) return ''
  const work = workRoute.split('\n')
  const guard = guardRoute.split('\n')
  return work.filter((route) => {
    // console.log(`route: ${route}`)
    // console.log(`reverse route: ${route.split("___").reverse().join("___")}`)
    const reversed = route.split('___').reverse().join('___')
    return guard.includes(route) || guard.includes(reversed)
  }).join('\n')
}

function commonLogicalElement (workMiddleE, guardMiddleE) {
  let emptyMiddleE = false
  ;[workMiddleE, guardMiddleE].forEach((elements) => {
    if (elements.length === 0) {
      emptyMiddleE = true
    }
  })
  if (emptyMiddleE) return ''
  return workMiddleE.filter(element => guardMiddleE.includes(element)).join('\n')
}

function generateSQL (workRoute, guardRoute) {
  let emptyTunnle = false
  ;[workRoute, guardRoute].forEach((route) => {
    if (route === '查无此Tunnel' || route === '查无保护组') {
      emptyTunnle = true
    }
  })
  if (emptyTunnle) return ''
  // const work = workRoute.split("\n")
  // const guard = guardRoute.split("\n")
  const originalRoutes = [workRoute.split('\n'), guardRoute.split('\n')]
  const reversedRoutes = [originalRoutes[0].map(r => r.split('___').reverse().join('___')),
    originalRoutes[1].map(r => r.split('___').reverse().join('___'))]
  const routes = [[...originalRoutes[0], ...reversedRoutes[0]],
    [...originalRoutes[1], ...reversedRoutes[1]]]
  // console.log(routes)
  const sqls = []
  const temp = []
  for (let i = 0; i < 2; i += 1) {
    routes[i].forEach(route => temp.push(`name = "${route}"`))
    sqls.push(`select
      group_concat(name, "$record.icymind.com$") as names_group,
      group_concat(elements, "$record.icymind.com$") as elements_group,
      "${i === 0 ? 'work' : 'guard'}" as type
      from physical_tunnels where ${temp.join(' or ')}`)
    temp.length = 0
  }
  return ` select
      group_concat(names_group, "$type.icymind.com$") as names_group,
      group_concat(elements_group, "$type.icymind.com$") as elements_group,
      group_concat(type, "$type.icymind.com$") as types_group
      from
      ( ${sqls[0]} union ${sqls[1]})`
}

function commonPhysicalTunnel (db, workRoute, guardRoute) {
  const sql = generateSQL(workRoute, guardRoute)
  // console.log(sql)
  if (!sql) {
    return ''
  }
  return new Promise((resolve, reject) => {
    db.get(sql, (err, row) => {
      if (err) {
        console.log(err)
        reject(err)
      } else {
        resolve(row)
      }
    })
  }).then((row) => {
    if (!row.elements_group || row.elements_group.indexOf('$type.icymind.com$') < 0) {
      return ''
    }
    const map = new Map()
    const names = row.names_group.split('$type.icymind.com$')
    const elements = row.elements_group.split('$type.icymind.com$')
    const types = row.types_group.split('$type.icymind.com$')
    const tunnelNames = [names[types.indexOf('work')].split('$record.icymind.com$'), names[types.indexOf('guard')].split('$record.icymind.com$')]
    const tunnelElements = [elements[types.indexOf('work')].split('$record.icymind.com$'), elements[types.indexOf('guard')].split('$record.icymind.com$')]
    const commonSegments = []
    const setInCurrentLoop = new Map()
    for (let i = 0; i < tunnelNames.length; i += 1) {
      const typeName = i ? 'guard' : 'work'
      for (let j = 0; j < tunnelNames[i].length; j += 1) {
        const obj = { name: tunnelNames[i][j], type: typeName }
        tunnelElements[i][j].split('\n').forEach((segment) => {
          if (map.has(segment)) {
            if (i === 1 && !setInCurrentLoop.has(segment)) { commonSegments.push(segment) }
            map.set(segment, [...map.get(segment), obj])
            if (i === 1) { setInCurrentLoop.set(segment, true) }
          } else {
            map.set(segment, [obj])
            if (i === 1) { setInCurrentLoop.set(segment, true) }
          }
        })
      }
    }
    const result = []
    commonSegments.forEach((segment) => {
      const [work, guard] = [[], []]
      map.get(segment).forEach((obj) => {
        if (obj.type === 'work') {
          work.push(obj.name)
        } else {
          guard.push(obj.name)
        }
      })
      result.push(`${segment}\n工作归属:\n${work.join('\n')}\n保护归属:\n${guard.join('\n')}`)
    })
    return result.join('\n\n')
  })
}

function sqlRowToCSVRow (record, type) {
  const tunnelType = type === '工作' ? 'work' : 'guard'
  const BDest = record[`business_${tunnelType}_dest`]
  // 从业务表里提取出的隧道名称
  let BTName = record[`business_${tunnelType}_name`]
  // 从 Tunnel 表里提取的隧道名称. 如果该名称为空, 说明找不到对应的 Tunnel
  const TTName = record[`tunnel_${tunnelType}_name`]
  const TSrc = record[`tunnel_${tunnelType}_src`]
  const TDest = record[`tunnel_${tunnelType}_dest`]
  const TMiddleElements = record[`tunnel_${tunnelType}_middle_elements`]
    ? record[`tunnel_${tunnelType}_middle_elements`].split('\n') : []
  const TMiddleInPorts = record[`tunnel_${tunnelType}_middle_in_ports`]
    ? record[`tunnel_${tunnelType}_middle_in_ports`].split('\n') : []
  const TMiddleOutPorts = record[`tunnel_${tunnelType}_middle_out_ports`]
    ? record[`tunnel_${tunnelType}_middle_out_ports`].split('\n') : []
  const businessType = record.hasOwnProperty('gg_name') ? 'non-lte' : 'lte'

  const result = []
  result.push(record.business_name)
  result.push(type)
  result.push(record.business_src)
  if (!BTName || BTName === 'null') {
    BTName = ''
  }
  if (!BTName) {
    result.push('')
  } else {
    result.push(BDest)
  }
  result.push(BTName)
  if (businessType === 'non-lte' && (!record.gg_name || record.gg_name === 'null')) {
    result.push('查无保护组')
  } else if (businessType === 'lte' && (!TTName || TTName === 'null')) {
    result.push('查无此Tunnel')
  } else {
    const segments = []
    const routes = []
    segments.push(TSrc)
    if (TMiddleElements.length === TMiddleInPorts.length &&
      TMiddleElements.length === TMiddleOutPorts.length) {
      for (let i = 0, len = TMiddleInPorts.length; i < len; i += 1) {
        segments.push(`${TMiddleElements[i]}-${TMiddleInPorts[i]}`)
        segments.push(`${TMiddleElements[i]}-${TMiddleOutPorts[i]}`)
      }
      segments.push(TDest)
      for (let i = 1, len = segments.length; i < len; i += 2) {
        routes.push(`${segments[i - 1]}___${segments[i]}`)
      }
      result.push(routes.join('\n'))
    } else {
      console.log(TMiddleElements)
      result.push('')
    }
  }
  result.push(TMiddleElements)
  return result
}

async function sqlRowToCSVRows (db, row) {
  const work = sqlRowToCSVRow(row, '工作')
  const guard = sqlRowToCSVRow(row, '保护')
  const workMiddleE = work.pop()
  const guardMiddleE = guard.pop()
  const workRoute = work[work.length - 1]
  const guardRoute = guard[guard.length - 1]
  const inCommonL = commonLogicalTunnel(workRoute, guardRoute)
  work.push(inCommonL)
  guard.push(inCommonL)
  const inCommonE = commonLogicalElement(workMiddleE, guardMiddleE)
  work.push(inCommonE)
  guard.push(inCommonE)
  const inCommonP = await commonPhysicalTunnel(db, workRoute, guardRoute)
  work.push(inCommonP)
  guard.push(inCommonP)
  return [work, guard]
}

function writeCSVHeader (ws, encoding) {
  const header = [['业务名称', '保护形式', '源网元信息', '宿网元信息', '承载Tunnel名称', '承载Tunnel路由', '逻辑同路由', '逻辑同节点', '物理同路由']]

  const out = `${papa.unparse(header, { header: false })}\r\n`
  if (encoding === 'utf8') {
    // ws.write(new Buffer('\xEF\xBB\xBF', 'binary'))
    ws.write(Buffer.from('\xEF\xBB\xBF', 'binary'))
    ws.write(out)
  } else {
    ws.write(iconv.encode(out, encoding))
  }
}
async function exportToCSV (db, file, type, exportAll, pagination, encoding = 'utf8', callback) {
  const view = type === 'lte' ? 'lte_common_logical_view' : 'non_lte_common_logical_view'
  const stmt = db.prepare(`select * from ${view}`)

  let writeOutCounter = 0
  let page = 1
  const dirname = path.dirname(file)
  const basename = path.basename(file, '.csv')
  const encodingLowerCase = encoding.toLowerCase()

  let ws = fs.createWriteStream(path.join(dirname, `${basename}-${page}.csv`))
  writeCSVHeader(ws, encodingLowerCase)
  let end = false

  while (!end) {
    const row = await getRecord(stmt)
    if (row) {
      const result = await sqlRowToCSVRows(db, row)
      if (exportAll || result[0][result[0].length - 1] ||
        result[0][result[0].length - 2] || result[0][result[0].length - 3]) {
        const out = `${papa.unparse(result, { header: false })}\r\n\r\n`
        if (encodingLowerCase === 'utf8') {
          ws.write(out)
        } else {
          ws.write(iconv.encode(out, encoding))
        }
        writeOutCounter += 1
        console.log(`${type}: ${writeOutCounter}`)
        if (pagination && writeOutCounter % pagination === 0) {
          ws.end()
          page += 1
          ws = fs.createWriteStream(path.join(dirname, `${basename}-${page}.csv`))
          writeCSVHeader(ws, encodingLowerCase)
        }
      }
    } else {
      await finalizePromise(stmt)
      end = true
      ws.end()
      if (typeof callback === 'function') {
        callback(writeOutCounter)
      }
    }
  }
}

// promise
function extractFile (db, file, type) {
  switch (type) {
    case 'lteb':
      return extractBusinessesPromise(db, file)
    case 'ltet':
      return extractTunnelsPromise(db, file, 'lte')
    case 'non-ltet':
      return extractTunnelsPromise(db, file, 'nonlte')
    case 'ces':
      return extractNonLTEBusinessesPromise(db, file, 'ces')
    case 'eth':
      return extractNonLTEBusinessesPromise(db, file, 'eth')
    case 'guard-group':
      return extractNonLTETunnelsGuardGroupPromise(db, file)
    case 'physical-tunnel':
      return extractPhysicalTunnelPromise(db, file)
    default:
      throw new Error('unsupport file')
  }
}

// promise
function createLTECommonRouteView (db) {
  const sql = String.raw`
    drop view if exists lte_common_logical_view;
    CREATE VIEW lte_common_logical_view as
      select
      b.name as business_name,
      (b.src_element || "-" || b.src_port) as business_src,
      (b.work_dest_element || "-" || b.work_dest_port) as business_work_dest,
      (b.guard_dest_element || "-" || b.guard_dest_port) as business_guard_dest,
      b.work_tunnel as business_work_name,
      w.name as tunnel_work_name,
      (w.src_element || "-" || w.src_port) as tunnel_work_src,
      (w.dest_element || "-" || w.dest_port) as tunnel_work_dest,
      w.middle_elements as tunnel_work_middle_elements,
      w.middle_in_ports as tunnel_work_middle_in_ports,
      w.middle_out_ports as tunnel_work_middle_out_ports,
      b.guard_tunnel as business_guard_name,
      g.name as tunnel_guard_name,
      (g.src_element || "-" || g.src_port) as tunnel_guard_src,
      (g.dest_element || "-" || g.dest_port) as tunnel_guard_dest,
      g.middle_elements as tunnel_guard_middle_elements,
      g.middle_in_ports as tunnel_guard_middle_in_ports,
      g.middle_out_ports as tunnel_guard_middle_out_ports
      from lte_businesses as b
      left join lte_tunnels as w
        on b.work_tunnel = w.name
      left join lte_tunnels as g
        on b.guard_tunnel = g.name
      `
  return new Promise((resolve, reject) => {
    db.exec(sql, resolve)
  })
}

// promise
function createNonLTEBTView (db) {
  const sql = String.raw`
    drop view if exists non_lte_b_t_view;
    CREATE VIEW non_lte_b_t_view as
      select
      b.name as business_name,
      (b.src_element || "-" || b.src_port) as business_src,
      (b.dest_element || "-" || b.dest_port) as business_work_dest,
      b.tunnel_name as business_work_name,
      t.work_tunnel as tunnel_work_name,
      t.guard_tunnel as business_guard_name,
      t.guard_tunnel as tunnel_guard_name,
      t.name as gg_name
      from non_lte_businesses as b
      left join non_lte_tunnels_guard_group as t
        on b.tunnel_name = t.work_tunnel
      `

  return new Promise((resolve, reject) => {
    db.exec(sql, resolve)
  })
}
// promise
function createNonLTECommonRouteView (db) {
  const sql = String.raw`
    drop view if exists non_lte_common_logical_view;
    CREATE VIEW non_lte_common_logical_view as
      select
      b.business_name as business_name,
      b.business_src as business_src,
      b.business_work_dest as business_work_dest,
      (g.dest_element || "-" || g.dest_port) as business_guard_dest,
      b.business_work_name as business_work_name,
      w.name as tunnel_work_name,
      (w.src_element || "-" || w.src_port) as tunnel_work_src,
      (w.dest_element || "-" || w.dest_port) as tunnel_work_dest,
      w.middle_elements as tunnel_work_middle_elements,
      w.middle_in_ports as tunnel_work_middle_in_ports,
      w.middle_out_ports as tunnel_work_middle_out_ports,
      b.business_guard_name as business_guard_name,
      g.name as tunnel_guard_name,
      (g.src_element || "-" || g.src_port) as tunnel_guard_src,
      (g.dest_element || "-" || g.dest_port) as tunnel_guard_dest,
      g.middle_elements as tunnel_guard_middle_elements,
      g.middle_in_ports as tunnel_guard_middle_in_ports,
      g.middle_out_ports as tunnel_guard_middle_out_ports,
      b.gg_name as gg_name
      from non_lte_b_t_view as b
      left join non_lte_tunnels as w
        on b.business_work_name = w.name
      left join non_lte_tunnels as g
        on b.business_guard_name = g.name
    `
  return new Promise((resolve, reject) => {
    db.exec(sql, resolve)
  })
}

// promise
function createTables (db) {
  return Promise.all([
    createTunnelsTable(db, 'lte'),
    createBusinessesTable(db),
    createTunnelsTable(db, 'non_lte'),
    createNonLTEBusinessesTable(db),
    createNonLTETunnelsGuardGroupTable(db),
    createPhysicalTunnelsTable(db)
  ]).then(() => {
    const promises = Promise.all([
      createLTECommonRouteView(db),
      createNonLTEBTView(db)
    ])
    return promises
  }).then(() => createNonLTECommonRouteView(db))
}

async function queryBusiness (db, name) {
  const sql = `select * from non_lte_common_logical_view where business_name = "${name}"
  union all select *, "icymind.com" as gg_name from lte_common_logical_view where business_name = "${name}"`

  const rows = await getAllRecords(db, sql)
  const results = []
  const promises = []
  rows.forEach((row) => {
    const p = new Promise((resolve, reject) => {
      sqlRowToCSVRows(db, row).then((csvRows) => {
        const type = row.gg_name === 'icymind.com' ? 'LTE' : '非LTE'
        results.push({ rows: csvRows, type })
        resolve()
      }).catch(err => console.log(err))
    })
    promises.push(p)
  })
  await Promise.all(promises)
  // console.log(results)
  return results
}

module.exports = {
  createTables,
  extractFile,
  getRecord,
  closeDB,
  queryBusiness,
  exportToCSV
}
