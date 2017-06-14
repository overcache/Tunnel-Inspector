/* global $ */
const fs = require('fs-extra')
const path = require('path')
const os = require('os')
const glob = require('glob')
const { dialog, app } = require('electron').remote
const shell = require('electron').shell
const csv = require('./csv.js')
const sqlite3 = require('sqlite3').verbose()

const dbfile = path.join(app.getPath('appData'), 'Tunnel-Inspector/CMCC.db')

function deleteDb (filePath) {
  return new Promise((resolve) => {
    fs.pathExists(filePath, (_err, exists) => {
      if (exists) {
        fs.remove(filePath, resolve)
      } else {
        resolve()
      }
    })
  })
}
// function clearClassList (element) {
//   if (element.classList) {
//     while (element.classList.length > 0) {
//       element.classList.remove(element.classList[0])
//     }
//   }
// }

function showModalInfo (message) {
  document.getElementById('modal-info').innerHTML = message
  $('.info.modal')
    .modal({
      dimmerSettings: {
        opacity: 0.2
      }
    })
    .modal('show')
}
function showOpenDialog (type, filters) {
  // type: openDirectory, openFile
  const selecteds = dialog.showOpenDialog({
    properties: type,
    filters
  })
  if (selecteds) {
    return selecteds[0]
  }
  return null
}

function importFromDb () {
  const file = showOpenDialog(
    ['openFile'],
    [
      { name: 'DB', extensions: ['db'] }
    ]
  )
  if (file) {
    fs.stat(file, (err, stats) => {
      if (err) {
        showModalInfo(err)
      } else if (stats.isFile()) {
        fs.copy(file, dbfile, (err) => {
          showModalInfo(err || '数据库导入完成')
        })
      }
    })
  }
}
function importFromFile () {
  // 初始化steps-modal
  resetSelectFiles()
  $('.select-files.modal')
      .modal({
        dimmerSettings: {
          opacity: 0.2
        },
        closable: false
      })
      .modal('show')
}
function selectFile (event) {
  const inputField = event.target.previousElementSibling
  const popupDiv = event.target.parentElement.parentElement
  const file = showOpenDialog(
    ['openFile'],
    [{ name: 'CSV', extensions: ['csv'] }])
  if (file) {
    popupDiv.dataset.content = file
    $(popupDiv).popup()
    inputField.value = path.basename(file)
  }
}
function collectTextField () {
  const result = new Map()
  const fields = document.querySelectorAll('.files input')
  Array.from(fields).forEach((field) => {
    const pp = field.parentElement.parentElement
    result.set(field.id, pp.dataset.content)
  })
  return result
}
function fillInputField (id, file) {
  const element = document.getElementById(id)
  const popupDiv = element.parentElement.parentElement
  element.value = path.basename(file)
  popupDiv.dataset.content = file
}
function completeStep (idPrefix, time, recordCounter) {
  const stepDiv = document.getElementById(`${idPrefix}-step`)
  const icon = stepDiv.firstElementChild
  const description = stepDiv.querySelector('.description')
  icon.classList.remove('loading')
  // stepDiv.classList.remove("active")
  let infoText = ''
  if (idPrefix.indexOf('summary') < 0) {
    stepDiv.classList.add('completed')
    infoText += `耗时 ${time} 秒`
  } else {
    infoText += `${time} 秒`
  }
  if (recordCounter) {
    if (idPrefix.indexOf('export') < 0) {
      infoText += `. 共导入 ${recordCounter} 条记录`
    } else {
      infoText += `. 共导出 ${recordCounter} 条记录`
    }
  }
  description.innerHTML = infoText
}
function resetSelectFiles () {
  const inputWrapper = document.getElementsByClassName('input-wrapper')
  Array.from(inputWrapper).forEach((inputWrapperDiv) => {
    inputWrapperDiv.querySelector('input').value = ''
    inputWrapperDiv.dataset.content = ''
  })
}
function resetAllStep () {
  const steps = document.querySelectorAll('div.step')
  Array.from(steps).forEach((stepDiv) => {
    stepDiv.style.display = 'none'
    stepDiv.classList.remove('completed')
    stepDiv.classList.add('disabled')
    const description = stepDiv.querySelectorAll('div.description')[0]
    description.innerHTML = ''
  })
}
function activeStep (idPrefix) {
  const element = document.getElementById(`${idPrefix}-step`)
  // element.classList.add("active")
  element.classList.remove('disabled')
  const icon = element.firstElementChild
  if (idPrefix.indexOf('summary') < 0) {
    icon.classList.add('loading')
  }
}
function showStep (idPrefix) {
  document.getElementById(`${idPrefix}-step`).style.display = null
}

function newTable (result, type) {
  const [work, guard] = result
  const element = document.createElement('div')
  element.classList.add('result-item')
  element.innerHTML = `
        <div>
          <table class="ui very basic collapsing celled small table">
            <tbody>
              <tr> <td><h5>业务名称</h5></td>   <td>${work[0]}</td> </tr>
              <tr> <td><h5>业务类型</h5></td>   <td>${type}</td> </tr>
              <tr> <td><h5>源端信息</h5></td>   <td>${work[2]}</td> </tr>
              <tr> <td><h5>工作Tunnel</h5></td> <td>${work[4]}</td> </tr>
              <tr> <td><h5>保护Tunnel</h5></td> <td>${guard[4]}</td> </tr>
              <tr> <td><h5>工作路由</h5></td>   <td class="tunnel-cell">${work[5].replace(/\n/g, '<br>')}</td> </tr>
              <tr> <td><h5>保护路由</h5></td>   <td class="tunnel-cell">${guard[5].replace(/\n/g, '<br>')}</td> </tr>
              <tr> <td><h5>逻辑同路由</h5></td>   <td class="tunnel-cell">${work[6].replace(/\n/g, '<br>')}</td> </tr>
              <tr> <td><h5>逻辑同节点</h5></td>   <td class="tunnel-cell">${work[7].replace(/\n/g, '<br>')}</td> </tr>
              <tr> <td><h5>物理同路由</h5></td>   <td class="tunnel-cell">${work[8].replace(/\n/g, '<br>')}</td> </tr>
            </tbody>
          </table>
        </div>
        <div class="ui divider"></div>
      `
  return element
}
function resetResultModal (element) {
  document.getElementById('record-total').innerHTML = 0
  const items = document.getElementsByClassName('result-item')
  Array.from(items).forEach((item) => {
    element.removeChild(item)
  })
}

document.addEventListener('DOMContentLoaded', () => {
  // init dropdown
  $('.ui.dropdown').dropdown()
  $('.ui.checkbox').checkbox()
  document.getElementById('version').innerHTML = app.getVersion()

  document.getElementById('about').addEventListener('click', () => {
    $('.about.modal')
      .modal({
        dimmerSettings: {
          opacity: 0.2
        }
      })
      .modal('show')
  })

  document.getElementById('import').addEventListener('click', () => {
    $('.import.modal')
      .modal({
        dimmerSettings: {
          opacity: 0.2
        }
      })
      .modal('show')
  })

  document.getElementById('import-next-button').addEventListener('click', () => {
    $('.import.modal').modal('hide')
    const dataSource = document.querySelector('.data-source:checked').value
    if (dataSource === 'import-from-db') {
      importFromDb()
    } else if (dataSource === 'import-from-file') {
      importFromFile()
    }
  })

  document.getElementById('import-from-folder').addEventListener('click', () => {
    const folder = showOpenDialog(['openDirectory'])
    if (folder) {
      glob(`${folder}/**/*.csv`, {}, (err, files) => {
        if (err) {
          showModalInfo(err)
        } else {
          files.forEach((file) => {
            if (/光缆链接关系/.test(file)) {
              fillInputField('physical-tunnel', file)
            } else if (/共同路由/.test(file)) {
              // do nothing
            } else if (/保护组/.test(file)) {
              fillInputField('guard-group', file)
            } else if (/非\s*LTE.*Tunnel/i.test(file)) {
              fillInputField('non-ltet', file)
            } else if (/CES/i.test(file)) {
              fillInputField('ces', file)
            } else if (/ETH/i.test(file)) {
              fillInputField('eth', file)
            } else if (!/非/i.test(file) && /[^非]*LTE.*Tunnel/i.test(file)) {
              fillInputField('ltet', file)
            } else if (!/非/i.test(file) && /LTE/gi.test(file)) {
              fillInputField('lteb', file)
            }
          })
          $('.input-wrapper').popup()
        }
      })
    }
  })

  const filesButtons = document.querySelectorAll('.files button')
  Array.from(filesButtons).forEach((button) => {
    button.addEventListener('click', event => selectFile(event))
    button.addEventListener('mouseover', event => event.stopPropagation())
  })

  document.getElementById('import-from-file-next').addEventListener('click', async () => {
    const files = collectTextField()
    if (files.size === 0) {
      return
    }
    resetAllStep()
    showStep('create-table')
    files.forEach((value, key) => {
      if (value) {
        showStep(key)
      }
    })
    $('.importing.modal')
      .modal({
        dimmerSettings: {
          opacity: 0.2
        },
        closable: false
      })
      .modal('show')

    await deleteDb(dbfile)
    const db = new sqlite3.Database(dbfile)
    // db.run("pragma journal_mode=off")
    // db.run("pragma synchronous=off")
    activeStep('create-table')
    const startTime = Date.now()
    await csv.createTables(db)
    completeStep('create-table', (Date.now() - startTime) / 1000)
    const filesArr = []
    files.forEach(async (value, key) => {
      if (value) {
        filesArr.push([value, key])
      }
    })
    for (let i = 0; i < filesArr.length; i += 1) {
      activeStep(filesArr[i][1])
      const taskST = Date.now()
      const recordCounter = await csv.extractFile(db, filesArr[i][0], filesArr[i][1])
      // const recordCounter = 100
      completeStep(filesArr[i][1], (Date.now() - taskST) / 1000, recordCounter)
    }
    db.close()
    showStep('imported-summary')
    activeStep('imported-summary')
    completeStep('imported-summary', (Date.now() - startTime) / 1000)
    document.getElementById('done-steps').disabled = false
  })

  document.getElementById('done-steps').addEventListener('click', () => {
    $('.importing.modal')
      .modal('hide')
  })
  document.querySelector('.exporting.modal button').addEventListener('click', () => {
    $('.exporting.modal')
      .modal('hide')
  })

  document.getElementById('export').addEventListener('click', () => {
    // show export info
    $('.export.modal')
      .modal({
        dimmerSettings: {
          opacity: 0.2
        }
      })
      .modal('show')
  })

  document.querySelector('.export.modal button').addEventListener('click', async () => {
    const LTE = document.querySelector(".export.modal input[value='lte']").checked
    const nonLTE = document.querySelector(".export.modal input[value='non-lte']").checked
    if (!LTE && !nonLTE) {
      // showModalInfo("请至少选择一项")
      return
    }
    const savePath = showOpenDialog(['openDirectory'])
    if (savePath) {
      const db = new sqlite3.Database(dbfile)
      resetAllStep()
      if (LTE) showStep('exporting-lte')
      if (nonLTE) showStep('exporting-non-lte')
      $('.export.modal').modal('hide')
      $('.exporting.modal')
        .modal({
          dimmerSettings: {
            opacity: 0.2
          },
          closable: false
        })
        .modal('show')
      const taskBegin = Date.now()
      let exportEncoding = 'utf8'
      if (os.platform() === 'win32' && /^6\.1\.760[01]$/.test(os.release())) {
        exportEncoding = 'GB2312'
      }

      const exportAll = $('#export-all').dropdown('get value') === '1'
      let pagination = $('#export-pagination').dropdown('get value')
      if (pagination === '') {
        pagination = '0'
      }

      const tasks = []
      if (LTE) {
        const outFile = path.join(savePath, 'LTE业务共同路由.csv')
        tasks.push({
          outFile,
          type: 'lte'
        })
      }
      if (nonLTE) {
        const outFile = path.join(savePath, '非LTE业务共同路由.csv')
        tasks.push({
          outFile,
          type: 'non-lte'
        })
      }
      for (let i = 0; i < tasks.length; i += 1) {
        activeStep(`exporting-${tasks[i].type}`)
        const startTime = Date.now()
        await new Promise((resolve) => {
          csv.exportToCSV(db, tasks[i].outFile, tasks[i].type,
            exportAll, Number(pagination), exportEncoding, (recordCounter) => {
              completeStep(`exporting-${tasks[i].type}`, (Date.now() - startTime) / 1000, recordCounter)
              resolve()
            })
        })
      }
      db.close()
      showStep('exported-summary')
      activeStep('exported-summary')
      completeStep('exported-summary', (Date.now() - taskBegin) / 1000)
      document.querySelector('.exporting.modal button').classList.remove('disabled')
    }
  })

  document.getElementById('backup').addEventListener('click', () => {
    fs.stat(dbfile, (err, stats) => {
      if (err) {
        showModalInfo('数据库还未建立, 无需备份')
      } else if (stats.isFile()) {
        const backupPath = showOpenDialog(['openDirectory'])
        if (backupPath) {
          fs.copy(dbfile, path.join(backupPath, `CMCCbackup-${new Date().toISOString().slice(0, 10)}.db`), (err) => {
            showModalInfo(err || '备份完成')
          })
        }
      }
    })
  })

  document.getElementById('query-button').addEventListener('click', async (event) => {
    let queryText = document.getElementById('query-text').value
    if (!queryText) {
      queryText = '南宁江南区荣宝华商城LTE-网管'
    }
    const resultModal = document.querySelector('.query.modal')
    resetResultModal(resultModal)
    const db = new sqlite3.Database(dbfile)
    const csvRows = await csv.queryBusiness(db, queryText)
    db.close()
    document.getElementById('record-total').innerHTML = csvRows.length
    csvRows.forEach((result) => {
      resultModal.appendChild(newTable(result.rows, result.type))
    })
    $('.query.modal')
      .modal({
        dimmerSettings: {
          opacity: 0.2
        }
      })
    .modal('show')
  })

  $(document).on('click', "a[href^='http']", (event) => {
    event.preventDefault()
    shell.openExternal(event.target.href)
  })
})
