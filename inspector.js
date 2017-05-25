/* global $ */
const fs = require("fs-extra")
const path = require("path")
const glob = require("glob")
const { dialog, app } = require("electron").remote
const csv = require("./csv.js")
const sqlite3 = require("sqlite3").verbose()

const dbfile = path.join(app.getPath("appData"), "tunnelinspector/CMCC.db")

function clearClassList(element) {
  if (element.classList) {
    while (element.classList.length > 0) {
      element.classList.remove(element.classList[0])
    }
  }
}

function showModalInfo(message) {
  document.getElementById("modal-info").innerHTML = message
  $(".info.modal")
    .modal({
      dimmerSettings: {
        opacity: 0.2,
      },
    })
    .modal("show")
}
function showOpenDialog(type, filters) {
  // type: openDirectory, openFile
  const selecteds = dialog.showOpenDialog({
    properties: type,
    filters,
  })
  if (selecteds) {
    return selecteds[0]
  }
  return null
}

function importFromDb() {
  const file = showOpenDialog(
    ["openFile"],
    [
      { name: "DB", extensions: ["db"] },
    ],
  )
  if (file) {
    fs.stat(file, (err, stats) => {
      if (err) {
        showModalInfo(err)
      } else if (stats.isFile()) {
        fs.copy(file, dbfile, (err) => {
          showModalInfo(err || "数据库导入完成")
        })
      }
    })
  }
}
function importFromFile() {
  // 初始化steps-modal
  resetSelectFiles()
  $(".select-files.modal")
      .modal({
        dimmerSettings: {
          opacity: 0.2,
        },
        closable: false,
      })
      .modal("show")
}
function selectFile(event) {
  const inputField = event.target.previousElementSibling
  const popupDiv = event.target.parentElement.parentElement
  const file = showOpenDialog(
    ["openFile"],
    [{ name: "CSV", extensions: ["csv"] }])
  if (file) {
    popupDiv.dataset.content = file
    $(popupDiv).popup()
    inputField.value = path.basename(file)
  }
}
function collectTextField() {
  const result = new Map()
  const fields = document.querySelectorAll(".files input")
  Array.from(fields).forEach((field) => {
    const pp = field.parentElement.parentElement
    result.set(field.id, pp.dataset.content)
  })
  return result
}
function fillInputField(id, file) {
  const element = document.getElementById(id)
  const popupDiv = element.parentElement.parentElement
  element.value = path.basename(file)
  popupDiv.dataset.content = file
}
function completeStep(key, recordCounter) {
  const stepDiv = document.getElementById(`${key}-step`)
  const icon = stepDiv.firstElementChild
  const description = stepDiv.querySelector(".description")
  icon.classList.remove("loading")
  stepDiv.classList.add("completed")
  if (key !== "create-table") {
    if (key.indexOf("export") < 0) {
      description.innerHTML = `共导入 ${recordCounter} 条记录`
    } else {
      description.innerHTML = `共导出 ${recordCounter} 条记录`
    }
  }
}
function resetSelectFiles() {
  const inputWrapper = document.getElementsByClassName("input-wrapper")
  Array.from(inputWrapper).forEach((inputWrapperDiv) => {
    inputWrapperDiv.querySelector("input").value = ""
    inputWrapperDiv.dataset.content = ""
  })
}
function resetAllStep() {
  const steps = document.querySelectorAll("div.step")
  Array.from(steps).forEach((stepDiv) => {
    stepDiv.style.display = "none"
    stepDiv.classList.remove("completed")
    const icon = stepDiv.firstElementChild
    icon.classList.add("loading")
    const description = stepDiv.querySelectorAll("div.description")[0]
    description.innerHTML = ""
  })
}
function showStep(id) {
  document.getElementById(id).style.display = null
}

function newTable(result) {
  const work = result[0]
  const guard = result[1]
  const element = document.createElement("div")
  element.classList.add("result-item")
  element.innerHTML = `
        <div>
          <table class="ui very basic collapsing celled small table">
            <tbody>
              <tr> <td><h5>业务名称</h5></td>   <td>${work[0]}</td> </tr>
              <tr> <td><h5>源端信息</h5></td>   <td>${work[2]}</td> </tr>
              <tr> <td><h5>工作Tunnel</h5></td> <td>${work[4]}</td> </tr>
              <tr> <td><h5>保护Tunnel</h5></td> <td>${guard[4]}</td> </tr>
              <tr> <td><h5>工作路由</h5></td>   <td class="tunnel-cell">${work[5].replace(/\n/g, "<br>")}</td> </tr>
              <tr> <td><h5>保护路由</h5></td>   <td class="tunnel-cell">${guard[5].replace(/\n/g, "<br>")}</td> </tr>
              <tr> <td><h5>共同路由</h5></td>   <td class="tunnel-cell">${work[6].replace(/\n/g, "<br>")}</td> </tr>
            </tbody>
          </table>
        </div>
        <div class="ui divider"></div>
      `
  return element
}
function resetResultModal(element) {
  document.getElementById("record-total").innerHTML = 0
  const items = document.getElementsByClassName("result-item")
  Array.from(items).forEach((item) => {
    element.removeChild(item)
  })
}

document.addEventListener("DOMContentLoaded", () => {
  // init dropdown
  $(".ui.dropdown").dropdown()
  $(".ui.checkbox").checkbox()

  document.getElementById("about").addEventListener("click", () => {
    $(".about.modal")
      .modal({
        dimmerSettings: {
          opacity: 0.2,
        },
      })
      .modal("show")
  })

  document.getElementById("import").addEventListener("click", () => {
    $(".import.modal")
      .modal({
        dimmerSettings: {
          opacity: 0.2,
        },
      })
      .modal("show")
  })

  document.getElementById("import-next-button").addEventListener("click", () => {
    $(".import.modal").modal("hide")
    const dataSource = document.querySelector(".data-source:checked").value
    if (dataSource === "import-from-db") {
      importFromDb()
    } else if (dataSource === "import-from-file") {
      importFromFile()
    }
  })

  document.getElementById("import-from-folder").addEventListener("click", () => {
    const folder = showOpenDialog(["openDirectory"])
    if (folder) {
      glob(`${folder}/**/*.csv`, {}, (err, files) => {
        if (err) {
          showModalInfo(err)
        } else {
          files.forEach((file) => {
            if (/保护组/.test(file)) {
              fillInputField("guard-group", file)
            } else if (/非\s*LTE.*Tunnel/i.test(file)) {
              fillInputField("non-ltet", file)
            } else if (/CES/i.test(file)) {
              fillInputField("ces", file)
            } else if (/ETH/i.test(file)) {
              fillInputField("eth", file)
            } else if (!/非/i.test(file) && /[^非]*LTE.*Tunnel/i.test(file)) {
              fillInputField("ltet", file)
            } else if (!/非/i.test(file) && /LTE/gi.test(file)) {
              fillInputField("lteb", file)
            }
          })
          $(".input-wrapper").popup()
        }
      })
    }
  })

  const filesButtons = document.querySelectorAll(".files button")
  Array.from(filesButtons).forEach((button) => {
    button.addEventListener("click", event => selectFile(event))
    button.addEventListener("mouseover", event => event.stopPropagation())
  })

  document.getElementById("import-from-file-next").addEventListener("click", async () => {
    const files = collectTextField()
    if (files.size === 0) {
      return
    }
    resetAllStep()
    files.forEach((value, key) => {
      if (value) {
        showStep(`${key}-step`)
      }
    })
    $(".importing.modal")
      .modal({
        dimmerSettings: {
          opacity: 0.2,
        },
        closable: false,
      })
      .modal("show")

    const db = new sqlite3.Database(dbfile)
    await csv.createTables(db)
    completeStep("create-table")
    const promises = []
    files.forEach(async (value, key) => {
      if (value) {
        promises.push(csv.extractFile(db, value, key).then((recordCounter) => {
          completeStep(key, recordCounter)
        }))
      }
    })
    await Promise.all(promises)
    db.close()
    document.getElementById("done-steps").disabled = false
  })

  document.getElementById("done-steps").addEventListener("click", () => {
    $(".importing.modal")
      .modal("hide")
  })
  document.querySelector(".exporting.modal button").addEventListener("click", () => {
    $(".exporting.modal")
      .modal("hide")
  })

  document.getElementById("export").addEventListener("click", () => {
    // show export info
    $(".export.modal")
      .modal({
        dimmerSettings: {
          opacity: 0.2,
        },
      })
      .modal("show")
  })

  document.querySelector(".export.modal button").addEventListener("click", () => {
    const LTE = document.querySelector(".export.modal input[value='lte']").checked
    const nonLTE = document.querySelector(".export.modal input[value='non-lte']").checked
    if (!LTE && !nonLTE) {
      // showModalInfo("请至少选择一项")
      return
    }
    const savePath = showOpenDialog(["openDirectory"])
    if (savePath) {
      const db = new sqlite3.Database(dbfile)
      resetAllStep()
      if (LTE) showStep("exporting-lte-step")
      if (nonLTE) showStep("exporting-non-lte-step")
      $(".export.modal").modal("hide")
      $(".exporting.modal")
        .modal({
          dimmerSettings: {
            opacity: 0.2,
          },
          closable: false,
        })
        .modal("show")
      const promises = []
      if (LTE) {
        const ws = fs.createWriteStream(path.join(savePath, "LTE业务共同路由.csv"))
        ws.write("\ufeff")
        const p1 = new Promise((resolve) => {
          csv.exportLTE(db, ws, (recordCounter) => {
            resolve(recordCounter)
          })
        })
        const p2 = new Promise((resolve) => {
          ws.on("finish", () => {
            resolve()
          })
        })
        promises.push(Promise.all([p1, p2]).then((results) => {
          completeStep("exporting-lte", results[0])
        }))
      }
      if (nonLTE) {
        const ws = fs.createWriteStream(path.join(savePath, "非LTE业务共同路由.csv"))
        ws.write("\ufeff")
        const p1 = new Promise((resolve) => {
          csv.exportNonLTE(db, ws, (recordCounter) => {
            resolve(recordCounter)
          })
        })
        const p2 = new Promise((resolve) => {
          ws.on("finish", () => {
            resolve()
          })
        })
        promises.push(Promise.all([p1, p2]).then((results) => {
          completeStep("exporting-non-lte", results[0])
        }))
      }
      Promise.all(promises).then(() => {
        document.querySelector(".exporting.modal button").classList.remove("disabled")
      })
    }
  })

  document.getElementById("backup").addEventListener("click", () => {
    fs.stat(dbfile, (err, stats) => {
      if (err) {
        showModalInfo("数据库还未建立, 无需备份")
      } else if (stats.isFile()) {
        const backupPath = showOpenDialog(["openDirectory"])
        if (backupPath) {
          fs.copy(dbfile, path.join(backupPath, `CMCCbackup-${new Date().toISOString().slice(0, 10)}.db`), (err) => {
            showModalInfo(err || "备份完成")
          })
        }
      }
    })
  })

  document.getElementById("query-button").addEventListener("click", async (event) => {
    const queryText = document.getElementById("query-text").value
    if (!queryText) return
    const resultModal = document.querySelector(".query.modal")
    resetResultModal(resultModal)
    const db = new sqlite3.Database(dbfile)
    const results = await csv.queryBusiness(db, queryText)
    document.getElementById("record-total").innerHTML = results.length
    results.forEach((result) => {
      resultModal.appendChild(newTable(result))
    })
    $(".query.modal")
      .modal({
        dimmerSettings: {
          opacity: 0.2,
        },
      })
    .modal("show")
  })
})
