/* eslint-disable camelcase */
const XLSX = require("xlsx")
const assert = require("assert")
const Exceljs = require("exceljs")

const tunnelCategoryColumns = "J"
const businessColumns = {
  basic: {
    column: "D",
    title: "基本信息",
    subCategories: {
      businessName: {
        title: "业务名称*",
        column: "D",
      },
    },
  },
  source: {
    title: "源端",
    column: "L",
    subCategories: {
      elementName: {
        title: "网元*",
        column: "L",
      },
      elementPort: {
        title: "端口*",
        column: "M",
      },
    },
  },
  destination: {
    title: "宿端",
    column: "U",
    subCategories: {
      elementName: {
        title: "网元*",
        column: "U",
      },
      elementPort: {
        title: "端口*",
        column: "V",
      },
    },
  },
}
const PWE3ETHHeaders = [
  "导入网管*",
  "是否反向业务*",
  "OID",
  "业务名称*",
  "业务ID",
  "客户名称",
  "承载业务类型",
  "模板名称*",
  "保护类型*",
  "源站点",
  "网元*",
  "端口*",
  "端口描述",
  "子接口ID",
  "VLAN ID",
  "Uni Qos Policy",
  "业务分界标签",
  "源优先级类型",
  "源优先级域",
  "网元*",
  "端口*",
  "端口描述",
  "子接口ID",
  "VLAN ID",
  "Uni Qos Policy",
  "业务分界标签",
  "宿优先级类型",
  "宿优先级域",
  "左网元*",
  "右网元*",
  "PW ID*",
  "PW标签",
  "Tunnel类型*",
  "Tunnel 名称",
  "PW Qos Policy",
  "PW模板",
  "管理PW",
  "保护模板名称",
  "左网元",
  "右网元",
  "PW ID",
  "PW标签",
  "Tunnel类型",
  "Tunnel 名称",
  "PW Qos Policy",
  "PW模板",
  "管理PW",
  "保护类型",
  "源保护组ID",
  "宿保护组ID",
  "备注",
  "描述",
  "客户业务类型",
  "区域",
  "定制属性1",
  "定制属性2",
  "Y.1731 TP OAM模板",
  "Y.1711 OAM模板",
  "BFD",
  "导入结果",
]

function getHeader_r(sheet) {
  const range = sheet["!ref"]
  const end_r = XLSX.utils.decode_range(range).e.r
  for (let i = 0; i <= end_r; i += 1) {
    const address = XLSX.utils.encode_cell({ c: 0, r: i })
    if (sheet[address] && sheet[address].v === "导入网管") {
      return i
    }
  }
  throw new Error("unkown layout")
}
function getHeader_c(header) {
  const alert = PWE3ETHHeaders.indexOf("保护类型*")
  const header_c = PWE3ETHHeaders.indexOf(header)
  return header_c > alert ? header_c + 1 : header_c
}

function getNextNotEmpty(sheet, address) {
  const range = sheet["!ref"]
  const endr = XLSX.utils.decode_range(range).e.r
  const currentCell = XLSX.utils.decode_cell(address)
  const currentr = currentCell.r
  const currentc = currentCell.c
  for (let i = currentr + 1; i <= endr; i += 1) {
    const nextCell = XLSX.utils.encode_cell({ c: currentc, r: i })
    if (sheet[nextCell]) {
      return nextCell
    }
  }
  return -1
}
function verifyBussinessHeader(sheet) {
  const headerRow = XLSX.utils.encode_row(getHeader_r(sheet))
  for (const key in businessColumns) {
    const value = businessColumns[key]
    assert.equal(sheet[`${value.column}${headerRow}`].v, value.title)
    for (const subCategory in value.subCategories) {
      const subValue = value.subCategories[subCategory]
      // console.log(`subValue.column: ${subValue.column}`)
      // console.log(`headerRow + 2: ${+headerRow + 2}`)
      assert.equal(sheet[`${subValue.column}${+headerRow + 2}`].v, subValue.title)
    }
  }
}

function verifyAllHeader(sheet) {
  const header_r = getHeader_r(sheet) + 2
  for (let index = 0, c = 0; index < PWE3ETHHeaders.length; index += 1, c += 1) {
    assert.equal(sheet[XLSX.utils.encode_cell({ c, r: header_r })].v, PWE3ETHHeaders[index])
    if (PWE3ETHHeaders[index] === "保护类型*") {
      // 保护类型* 占了两列
      c += 1
    }
  }
}

function verifyCell(sheet, r) {

}
function getTunnle(sheet, rowName, type) {
  const srcElementColumn = businessColumns.source.subCategories.elementName.column
  const srcPortColumn = businessColumns.source.subCategories.elementPort.column
  const destElementColumn = businessColumns.destination.subCategories.elementName.column
  const destPortColumn = businessColumns.destination.subCategories.elementPort.column
  console.log(`${srcElementColumn}${rowName}`)
  let row = rowName
  const srcElement = sheet[`${srcElementColumn}${row}`].v
  const srcPort = sheet[`${srcPortColumn}${row}`].v
  if (type === "guard") {
    row = XLSX.utils.encode_row(XLSX.utils.decode_row(row) + 1)
  }
  const destElement = sheet[`${destElementColumn}${row}`].v
  const destPort = sheet[`${destPortColumn}${row}`].v
  return { srcElement, srcPort, destElement, destPort }
}

function getBusinesses(sheet) {
  // business = { name: xxx,
  // workTunnel: { srcElement, srcPort, destElement, destPort},
  // guardTunnel: { xxx }}
  const header_r = getHeader_r(sheet)
  const end_r = XLSX.utils.decode_range(sheet["!ref"]).e.r
  const businessColumn = businessColumns.basic.subCategories.businessName.column
  const businesses = []
  for (let i = header_r + 3; i < end_r; i += 1) {
    const rowName = XLSX.utils.encode_row(i)
    if (sheet[`${businessColumn}${rowName}`] && sheet[`${businessColumn}${rowName}`].v !== "") {
      const business = {}
      business.name = sheet[`${businessColumn}${rowName}`].v
      business.workTunnel = getTunnle(sheet, rowName, "work")
      business.guardTunnel = getTunnle(sheet, rowName, "guard")
      businesses.push(business)
    }
  }
  return businesses
}

function readFileSync(file) {
  return XLSX.readFileSync(file, {
    cellFormula: false,
    cellHTML: false,
    cellText: false,
  })
}

function inspect(file) {
  //
  
}
function createLarge() {
  console.log("creating")
  const workbook = new Exceljs.stream.xlsx.WorkbookWriter({
    filename: "/Users/simon/Desktop/test.xlsx",
    useSharedStrings: true,
  })
  const worksheet = workbook.addWorksheet("data")
  const str = "Sit nemo repellat deserunt iure repudiandae? Iusto quaerat harum autem ex fugiat eius quidem? Non aliquid aspernatur ut delectus aliquid molestias molestias reiciendis? Quidem aliquid atque at mollitia nihil placeat, dolor eveniet cupiditate blanditiis sit? Debitis dolorum quidem voluptatum natus nemo excepturi voluptatum expedita distinctio hic! Labore iste quae dicta suscipit nesciunt eum quasi, voluptate modi? Minus laborum expedita perspiciatis iste aliquam architecto reprehenderit pariatur! Maiores deserunt elit deleniti soluta delectus et quia aperiam. Beatae voluptatibus ad dolor mollitia consequatur laborum non a quisquam. Reprehenderit animi dolores tenetur vero veniam quidem assumenda. Placeat nobis quod numquam aut commodi tempore tempore?"
  for (let i = 0; i < 5000000; i += 1) {
    worksheet.addRow([
      i + 1,
      str,
    ]).commit()
  }
  worksheet.commit()
  console.log("worksheet created")
  workbook.commit().then(() => {
    console.log("finished")
  }).catch((error) => {
    console.log(error)
  })
}

module.exports = {
  readFileSync,
  verifyBussinessHeader,
  getBusinesses,
  createLarge,
}
