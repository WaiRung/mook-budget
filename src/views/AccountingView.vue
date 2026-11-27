<template>
  <main class="budget-app">
    <header class="topbar">
      <div class="brand">
        <div class="brand-mark" aria-hidden="true">฿</div>
        <div>
          <h1>ระบบติดตามงบประมาณ</h1>
          <p>จัดการและบันทึกการใช้จ่ายจาก Excel</p>
        </div>
      </div>

      <label class="upload-button">
        <input type="file" accept=".xlsx,.xls" @change="handleUpload" />
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5" /></svg>
        เปิดไฟล์ Excel
      </label>
    </header>

    <section v-if="loading" class="state-card">
      <span class="spinner" aria-hidden="true"></span>
      <h2>กำลังอ่านไฟล์ Excel</h2>
      <p>ตรวจสอบหัวตาราง งวด และยอดรวม</p>
    </section>

    <section v-else-if="error" class="state-card state-card--error">
      <h2>ไม่สามารถอ่านไฟล์ได้</h2>
      <p>{{ error }}</p>
      <button type="button" @click="loadDefaultWorkbook">ลองใหม่อีกครั้ง</button>
    </section>

    <template v-else-if="selectedSheet && selectedTable">
      <section class="summary-strip" aria-label="สรุปงบประมาณ">
        <div class="file-summary">
          <span class="eyebrow">ไฟล์ปัจจุบัน</span>
          <strong>{{ fileName }}</strong>
          <span class="sheet-label"><i></i>{{ selectedSheet.name }}</span>
        </div>
        <div class="summary-stat">
          <span>งบทั้งหมด</span>
          <strong>{{ money(totalBudget) }}</strong>
        </div>
        <div class="summary-stat">
          <span>ใช้ไปแล้ว</span>
          <strong>{{ money(totalSpent) }}</strong>
        </div>
        <div class="summary-stat summary-stat--balance">
          <span>คงเหลือ</span>
          <strong>{{ money(totalRemaining) }}</strong>
        </div>
      </section>

      <div class="toolbar">
        <div class="toolbar-title">
          <span class="eyebrow">ภาพรวม</span>
          <h2>ตารางงบประมาณ</h2>
        </div>
        <label class="sheet-picker">
          <span>ชีต</span>
          <select v-model="selectedSheetName">
            <option v-for="sheet in sheets" :key="sheet.name" :value="sheet.name">{{ sheet.name }}</option>
          </select>
        </label>
      </div>

      <section class="table-tabs" aria-label="เลือกตาราง">
        <button
          v-for="table in selectedSheet.tables"
          :key="table.id"
          type="button"
          :class="['table-tab', { active: table.id === selectedTable.id }]"
          @click="selectTable(table.id)"
        >
          <span class="table-number">{{ table.number }}</span>
          <span class="table-copy">
            <strong>{{ table.title }}</strong>
            <small>{{ table.items.length }} รายการ · {{ money(tableBudget(table)) }}</small>
          </span>
          <span class="table-balance">{{ money(tableRemaining(table)) }}</span>
        </button>
      </section>

      <section class="content-grid">
        <div class="items-panel">
          <div class="panel-heading">
            <div>
              <span class="eyebrow">ตาราง {{ selectedTable.number }}</span>
              <h2>{{ selectedTable.title }}</h2>
            </div>
            <span class="item-count">{{ selectedTable.items.length }} รายการ</span>
          </div>

          <div class="item-list">
            <button
              v-for="item in selectedTable.items"
              :key="item.id"
              type="button"
              :class="['item-card', { active: item.id === selectedItemId }]"
              @click="selectedItemId = item.id"
            >
              <span class="item-index">{{ item.rowNumber }}</span>
              <span class="item-copy">
                <strong>{{ item.name }}</strong>
                <small>{{ item.detail || 'ไม่มีรายละเอียดเพิ่มเติม' }}</small>
              </span>
              <span class="item-money">
                <strong>{{ money(itemRemaining(item)) }}</strong>
                <small>จาก {{ money(item.amount) }}</small>
              </span>
              <span class="progress-track" aria-hidden="true">
                <span :style="{ width: `${Math.min(100, itemProgress(item))}%` }"></span>
              </span>
            </button>
          </div>

          <div class="table-total">
            <div>
              <span>{{ selectedTable.summary.name }}</span>
              <small>จากยอดสรุปท้ายตาราง Excel</small>
            </div>
            <strong>{{ money(selectedTable.summary.amount || selectedTable.items.reduce((sum, item) => sum + item.amount, 0)) }}</strong>
          </div>
        </div>

        <aside v-if="selectedItem" class="detail-panel">
          <div class="detail-header">
            <span class="eyebrow">รายละเอียดรายการ</span>
            <h2>{{ selectedItem.name }}</h2>
            <p>{{ selectedItem.detail }}</p>
          </div>

          <div class="balance-card">
            <span>คงเหลือ</span>
            <strong>{{ money(itemRemaining(selectedItem)) }}</strong>
            <div class="balance-bar"><i :style="{ width: `${Math.min(100, itemProgress(selectedItem))}%` }"></i></div>
            <div class="balance-meta">
              <span>ใช้งบ {{ money(itemSpent(selectedItem)) }}</span>
              <span>{{ itemProgress(selectedItem).toFixed(0) }}%</span>
            </div>
          </div>

          <div class="periods">
            <div class="periods-title">แผนการแบ่งงวด</div>
            <div v-for="period in selectedItem.periods" :key="period.column" class="period-row">
              <div>
                <strong>{{ period.name || `คอลัมน์ ${period.column + 1}` }}</strong>
                <small>{{ period.detail }}</small>
              </div>
              <span>{{ money(period.amount) }}</span>
            </div>
          </div>

          <form class="transaction-form" @submit.prevent="addTransaction">
            <div class="form-title">
              <h3>บันทึกการใช้จ่าย</h3>
              <span>+ เพิ่มรายการ</span>
            </div>
            <label>
              <span>จำนวนเงิน (บาท)</span>
              <div class="amount-input">
                <input v-model="transactionAmount" type="number" min="0" step="0.01" placeholder="0.00" required />
                <small>บาท</small>
              </div>
            </label>
            <label>
              <span>รายละเอียด</span>
              <textarea v-model="transactionDetails" rows="4" placeholder="แต่ละบรรทัดคือรายละเอียดหนึ่งรายการ" required></textarea>
            </label>
            <p v-if="formMessage" class="form-message">{{ formMessage }}</p>
            <button class="save-button" type="submit">บันทึกการใช้จ่าย</button>
          </form>

          <div class="transactions">
            <div class="transactions-title">
              <h3>ประวัติการใช้จ่าย</h3>
              <span>{{ selectedTransactions.length }}</span>
            </div>
            <div v-if="!selectedTransactions.length" class="empty-transactions">ยังไม่มีรายการใช้จ่าย</div>
            <article v-for="transaction in selectedTransactions" :key="transaction.id" class="transaction">
              <div class="transaction-head">
                <strong>{{ money(transaction.amount) }}</strong>
                <button type="button" :aria-label="`ลบรายการ ${money(transaction.amount)}`" @click="deleteTransaction(transaction.id)">×</button>
              </div>
              <ul><li v-for="(detail, index) in transaction.details" :key="index">{{ detail }}</li></ul>
              <time>{{ formatDate(transaction.createdAt) }}</time>
            </article>
          </div>
        </aside>
      </section>
    </template>

    <section v-else class="state-card">
      <h2>ไม่พบตารางงบประมาณ</h2>
      <p>ไฟล์ต้องมีคอลัมน์ “รายการ”, “รายละเอียด”, “จำนวน (บาท)” และ “รวม”</p>
    </section>
  </main>
</template>

<script setup lang="ts">
import readXlsxFile, { readSheetNames } from 'read-excel-file'
import { computed, onMounted, ref, watch } from 'vue'
import { parseBudgetSheet, type ExcelRow } from '../lib/excelParser'
import type { BudgetItem, BudgetSheet, BudgetTable, ExpenseTransaction } from '../types/accounting'

const DEFAULT_FILE = '00_20251119 ปรับงบประมาณและแบ่งงวด.xlsx'
const STORAGE_KEY = 'mook-budget:transactions:v1'

const sheets = ref<BudgetSheet[]>([])
const selectedSheetName = ref('')
const selectedTableId = ref('')
const selectedItemId = ref('')
const fileName = ref(DEFAULT_FILE)
const loading = ref(true)
const error = ref('')
const transactions = ref<ExpenseTransaction[]>(loadTransactions())
const transactionAmount = ref<number | ''>('')
const transactionDetails = ref('')
const formMessage = ref('')

const selectedSheet = computed(() => sheets.value.find((sheet) => sheet.name === selectedSheetName.value) ?? null)
const selectedTable = computed(() => selectedSheet.value?.tables.find((table) => table.id === selectedTableId.value) ?? selectedSheet.value?.tables[0] ?? null)
const selectedItem = computed(() => selectedTable.value?.items.find((item) => item.id === selectedItemId.value) ?? selectedTable.value?.items[0] ?? null)
const currentItems = computed(() => selectedSheet.value?.tables.flatMap((table) => table.items) ?? [])
const totalBudget = computed(() => currentItems.value.reduce((sum, item) => sum + item.amount, 0))
const totalSpent = computed(() => currentItems.value.reduce((sum, item) => sum + itemSpent(item), 0))
const totalRemaining = computed(() => totalBudget.value - totalSpent.value)
const selectedTransactions = computed(() => selectedItem.value
  ? transactions.value.filter((transaction) => transaction.itemId === transactionKey(selectedItem.value!))
  : [])

function loadTransactions(): ExpenseTransaction[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return []
  }
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions.value))
}

async function readWorkbook(blob: Blob, name: string) {
  loading.value = true
  error.value = ''
  fileName.value = name
  try {
    const names = await readSheetNames(blob)
    const parsedSheets: BudgetSheet[] = []
    for (const sheetName of names) {
      const rows = await readXlsxFile(blob, { sheet: sheetName }) as ExcelRow[]
      const parsed = parseBudgetSheet(sheetName, rows)
      if (parsed?.tables.length) parsedSheets.push(parsed)
    }
    if (!parsedSheets.length) throw new Error('ไม่พบคอลัมน์ที่กำหนดในไฟล์ Excel นี้')
    sheets.value = parsedSheets
    selectedSheetName.value = parsedSheets.find((sheet) => sheet.name === 'ทำสัญญา_')?.name ?? parsedSheets[0]!.name
  } catch (cause) {
    console.error(cause)
    error.value = cause instanceof Error ? cause.message : 'ไฟล์อาจเสียหายหรือไม่ใช่ไฟล์ Excel'
  } finally {
    loading.value = false
  }
}

async function loadDefaultWorkbook() {
  loading.value = true
  error.value = ''
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}${encodeURI(DEFAULT_FILE)}`)
    if (!response.ok) throw new Error(`ไม่พบไฟล์ Excel ในโปรเจกต์ (${response.status})`)
    await readWorkbook(await response.blob(), DEFAULT_FILE)
  } catch (cause) {
    loading.value = false
    error.value = cause instanceof Error ? cause.message : 'ไม่สามารถโหลดไฟล์เริ่มต้นได้'
  }
}

async function handleUpload(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) await readWorkbook(file, file.name)
}

function selectTable(id: string) {
  selectedTableId.value = id
  selectedItemId.value = selectedSheet.value?.tables.find((table) => table.id === id)?.items[0]?.id ?? ''
  formMessage.value = ''
}

function transactionKey(item: BudgetItem) {
  return `${fileName.value}::${item.id}`
}

function itemSpent(item: BudgetItem) {
  const key = transactionKey(item)
  return transactions.value
    .filter((transaction) => transaction.itemId === key)
    .reduce((sum, transaction) => sum + transaction.amount, 0)
}

function itemRemaining(item: BudgetItem) {
  return item.amount - itemSpent(item)
}

function itemProgress(item: BudgetItem) {
  return item.amount > 0 ? (itemSpent(item) / item.amount) * 100 : 0
}

function tableBudget(table: BudgetTable) {
  return table.items.reduce((sum, item) => sum + item.amount, 0) || table.summary.amount
}

function tableRemaining(table: BudgetTable) {
  return table.items.reduce((sum, item) => sum + itemRemaining(item), 0)
}

function addTransaction() {
  if (!selectedItem.value || transactionAmount.value === '') return
  const amount = Number(transactionAmount.value)
  const details = transactionDetails.value.split(/\r?\n/).map((detail) => detail.trim()).filter(Boolean)
  if (!Number.isFinite(amount) || amount <= 0) {
    formMessage.value = 'จำนวนเงินต้องมากกว่า 0 บาท'
    return
  }
  if (amount > itemRemaining(selectedItem.value)) {
    formMessage.value = `จำนวนเงินเกินยอดคงเหลือ ${money(itemRemaining(selectedItem.value))}`
    return
  }
  if (!details.length) {
    formMessage.value = 'กรุณากรอกรายละเอียดอย่างน้อย 1 รายการ'
    return
  }
  transactions.value.unshift({
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    itemId: transactionKey(selectedItem.value),
    amount,
    details,
    createdAt: new Date().toISOString(),
  })
  saveTransactions()
  transactionAmount.value = ''
  transactionDetails.value = ''
  formMessage.value = ''
}

function deleteTransaction(id: string) {
  if (!window.confirm('ลบรายการใช้จ่ายนี้หรือไม่?')) return
  transactions.value = transactions.value.filter((transaction) => transaction.id !== id)
  saveTransactions()
}

function money(value: number) {
  return new Intl.NumberFormat('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(value)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

watch(selectedSheet, (sheet) => {
  selectedTableId.value = sheet?.tables[0]?.id ?? ''
  selectedItemId.value = sheet?.tables[0]?.items[0]?.id ?? ''
})

watch(selectedItem, (item) => {
  formMessage.value = ''
  if (!item) return
  transactionAmount.value = ''
  transactionDetails.value = ''
})

onMounted(loadDefaultWorkbook)
</script>

<style scoped>
.budget-app { --ink: #14213d; --muted: #748099; --line: #e6eaf0; --blue: #2f66f5; min-height: 100dvh; background: #f5f7fb; color: var(--ink); padding-bottom: 3rem; }
.topbar { min-height: 88px; display: flex; align-items: center; justify-content: space-between; gap: 1.5rem; padding: 1rem max(1.25rem, calc((100vw - 1440px) / 2)); background: white; border-bottom: 1px solid var(--line); }
.brand { display: flex; align-items: center; gap: .85rem; }
.brand-mark { width: 44px; height: 44px; display: grid; place-items: center; border-radius: 14px; color: white; background: linear-gradient(145deg, #3978ff, #1b4ed8); font-size: 1.55rem; font-weight: 800; box-shadow: 0 8px 18px #2f66f536; }
h1,h2,h3,p { margin: 0; }
.brand h1 { font-size: 1.15rem; letter-spacing: -.02em; }
.brand p { margin-top: .12rem; color: var(--muted); font-size: .82rem; }
.upload-button { display: flex; align-items: center; gap: .55rem; padding: .7rem 1rem; border: 1px solid #d9e1ee; border-radius: 11px; background: white; color: #31415f; font-size: .9rem; font-weight: 650; cursor: pointer; box-shadow: 0 2px 7px #14213d08; }
.upload-button input { display: none; }
.upload-button svg { width: 18px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
.summary-strip,.toolbar,.table-tabs,.content-grid { max-width: 1440px; margin-inline: auto; }
.summary-strip { margin-top: 1.5rem; display: grid; grid-template-columns: minmax(300px, 2fr) repeat(3, minmax(150px, 1fr)); gap: 1px; overflow: hidden; background: var(--line); border: 1px solid var(--line); border-radius: 18px; box-shadow: 0 10px 30px #172b4d0a; }
.file-summary,.summary-stat { min-height: 118px; padding: 1.25rem 1.5rem; background: white; display: flex; flex-direction: column; justify-content: center; }
.file-summary strong { max-width: 530px; margin: .35rem 0 .55rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 1rem; }
.eyebrow { color: #7b89a5; font-size: .7rem; letter-spacing: .1em; font-weight: 800; text-transform: uppercase; }
.sheet-label { display: flex; align-items: center; gap: .4rem; color: var(--muted); font-size: .78rem; }
.sheet-label i { width: 7px; height: 7px; border-radius: 50%; background: #22b983; }
.summary-stat span { color: var(--muted); font-size: .78rem; }
.summary-stat strong { margin-top: .5rem; font-size: clamp(1.3rem, 2.2vw, 1.8rem); letter-spacing: -.04em; }
.summary-stat strong::after { content: ' ฿'; color: #9aa5b9; font-size: .8rem; font-weight: 600; }
.summary-stat--balance strong { color: #168b68; }
.toolbar { margin-top: 2rem; display: flex; align-items: end; justify-content: space-between; gap: 1rem; }
.toolbar-title h2 { margin-top: .2rem; font-size: 1.35rem; }
.sheet-picker { display: flex; align-items: center; gap: .65rem; color: var(--muted); font-size: .78rem; }
.sheet-picker select { min-width: 190px; border: 1px solid var(--line); border-radius: 9px; padding: .55rem 2rem .55rem .75rem; background: white; color: var(--ink); font-weight: 600; }
.table-tabs { margin-top: 1rem; display: grid; grid-template-columns: repeat(4, 1fr); gap: .7rem; }
.table-tab { min-width: 0; position: relative; display: flex; align-items: center; gap: .75rem; min-height: 100px; padding: 1rem; text-align: left; border: 1px solid var(--line); border-radius: 14px; background: white; cursor: pointer; transition: border-color .15s, box-shadow .15s, transform .15s; }
.table-tab:hover { transform: translateY(-1px); border-color: #b9c9f2; }
.table-tab.active { border-color: #2f66f5; box-shadow: 0 0 0 2px #2f66f512, 0 7px 18px #2f66f50e; }
.table-number { flex: 0 0 auto; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 10px; background: #eff3fa; color: #53627b; font-weight: 800; }
.table-tab.active .table-number { background: var(--blue); color: white; }
.table-copy { min-width: 0; display: flex; flex-direction: column; }
.table-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .86rem; }
.table-copy small { margin-top: .35rem; color: var(--muted); font-size: .68rem; }
.table-balance { margin-left: auto; align-self: end; color: #168b68; font-size: .72rem; font-weight: 700; }
.content-grid { margin-top: 1rem; display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(340px, .9fr); gap: 1rem; align-items: start; }
.items-panel,.detail-panel { border: 1px solid var(--line); border-radius: 18px; background: white; box-shadow: 0 10px 30px #172b4d08; overflow: hidden; }
.panel-heading,.detail-header { padding: 1.35rem 1.5rem; border-bottom: 1px solid var(--line); }
.panel-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.panel-heading h2,.detail-header h2 { margin-top: .25rem; font-size: 1rem; }
.item-count { padding: .35rem .6rem; border-radius: 999px; color: #5c6a83; background: #f2f5fa; font-size: .7rem; font-weight: 700; }
.item-list { display: flex; flex-direction: column; }
.item-card { position: relative; display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; align-items: center; gap: .75rem; width: 100%; padding: 1rem 1.5rem; text-align: left; border: 0; border-bottom: 1px solid #edf0f5; background: white; cursor: pointer; }
.item-card:hover,.item-card.active { background: #f7f9ff; }
.item-card.active::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 3px; background: var(--blue); }
.item-index { width: 32px; height: 32px; display: grid; place-items: center; border-radius: 9px; background: #f2f5fa; color: #8791a5; font-size: .68rem; font-weight: 700; }
.item-copy,.item-money { display: flex; flex-direction: column; min-width: 0; }
.item-copy strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: .86rem; }
.item-copy small,.item-money small { margin-top: .2rem; overflow: hidden; color: var(--muted); text-overflow: ellipsis; white-space: nowrap; font-size: .7rem; }
.item-money { align-items: end; }
.item-money strong { color: #273b64; font-size: .84rem; }
.progress-track { grid-column: 2 / -1; height: 3px; border-radius: 4px; background: #edf0f5; overflow: hidden; }
.progress-track span { display: block; height: 100%; background: #4f7cf3; }
.table-total { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding: 1.1rem 1.5rem; background: #f7f9fc; }
.table-total div { display: flex; flex-direction: column; }
.table-total span { font-size: .82rem; font-weight: 750; }
.table-total small { margin-top: .15rem; color: var(--muted); font-size: .67rem; }
.table-total strong { font-size: 1rem; }
.detail-panel { position: sticky; top: 1rem; }
.detail-header p { margin-top: .55rem; color: var(--muted); font-size: .8rem; line-height: 1.55; }
.balance-card { margin: 1rem 1.25rem; padding: 1.1rem; border: 1px solid #dbe9e3; border-radius: 13px; background: linear-gradient(145deg, #f6fcf9, #fafffd); }
.balance-card > span { color: #4f7f6e; font-size: .75rem; }
.balance-card > strong { display: block; margin: .25rem 0 .75rem; color: #14795e; font-size: 1.65rem; letter-spacing: -.03em; }
.balance-bar { height: 6px; overflow: hidden; border-radius: 5px; background: #dcece5; }
.balance-bar i { display: block; height: 100%; border-radius: inherit; background: #2eb487; }
.balance-meta { display: flex; justify-content: space-between; margin-top: .45rem; color: #648276; font-size: .68rem; }
.periods { padding: 0 1.25rem 1rem; }
.periods-title { margin-bottom: .45rem; color: #77839a; font-size: .7rem; font-weight: 750; }
.period-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding: .55rem 0; border-bottom: 1px solid #edf0f5; }
.period-row div { min-width: 0; display: flex; flex-direction: column; }
.period-row strong { font-size: .74rem; }
.period-row small { color: var(--muted); font-size: .64rem; }
.period-row > span { white-space: nowrap; font-size: .75rem; font-weight: 650; }
.transaction-form { padding: 1.15rem 1.25rem; border-block: 1px solid var(--line); background: #fafbfe; }
.form-title,.transactions-title { display: flex; justify-content: space-between; align-items: center; }
.form-title h3,.transactions-title h3 { font-size: .86rem; }
.form-title > span { color: var(--blue); font-size: .7rem; font-weight: 700; }
.transaction-form label { display: block; margin-top: .9rem; }
.transaction-form label > span { display: block; margin-bottom: .35rem; color: #64718a; font-size: .7rem; font-weight: 650; }
.amount-input { position: relative; }
.amount-input input { width: 100%; padding-right: 3rem; }
.amount-input small { position: absolute; right: .75rem; top: 50%; transform: translateY(-50%); color: var(--muted); font-size: .7rem; }
.transaction-form input,.transaction-form textarea { width: 100%; border: 1px solid #dce2ec; border-radius: 9px; padding: .72rem .8rem; outline: none; background: white; font-size: .8rem; }
.transaction-form input:focus,.transaction-form textarea:focus { border-color: #6d91ef; box-shadow: 0 0 0 3px #2f66f512; }
.transaction-form textarea { resize: vertical; line-height: 1.5; }
.form-message { margin-top: .65rem; color: #c04444; font-size: .72rem; }
.save-button { width: 100%; margin-top: .85rem; border: 0; border-radius: 10px; padding: .8rem; background: var(--blue); color: white; font-size: .82rem; font-weight: 750; cursor: pointer; box-shadow: 0 7px 16px #2f66f524; }
.transactions { padding: 1.1rem 1.25rem 1.3rem; }
.transactions-title > span { min-width: 24px; padding: .15rem .45rem; border-radius: 999px; background: #eef3ff; color: var(--blue); text-align: center; font-size: .65rem; font-weight: 700; }
.empty-transactions { padding: 1.2rem 0 .3rem; color: #9aa3b3; text-align: center; font-size: .75rem; }
.transaction { margin-top: .75rem; padding: .8rem; border: 1px solid var(--line); border-radius: 10px; }
.transaction-head { display: flex; justify-content: space-between; gap: .5rem; }
.transaction-head strong { font-size: .83rem; }
.transaction-head button { width: 24px; height: 24px; border: 0; border-radius: 7px; background: #f5f6f8; color: #9a6670; cursor: pointer; }
.transaction ul { margin: .45rem 0; padding-left: 1rem; color: #58657c; font-size: .72rem; line-height: 1.5; }
.transaction time { color: #9aa4b5; font-size: .63rem; }
.state-card { max-width: 620px; margin: 12vh auto 0; padding: 3rem 2rem; border: 1px solid var(--line); border-radius: 20px; background: white; text-align: center; box-shadow: 0 15px 40px #172b4d0c; }
.state-card h2 { margin-top: .8rem; font-size: 1.2rem; }
.state-card p { margin-top: .5rem; color: var(--muted); font-size: .85rem; }
.state-card button { margin-top: 1rem; border: 0; border-radius: 9px; padding: .7rem 1rem; background: var(--blue); color: white; cursor: pointer; }
.state-card--error { border-color: #f1d1d1; }
.spinner { width: 38px; height: 38px; display: inline-block; border: 3px solid #e8edf7; border-top-color: var(--blue); border-radius: 50%; animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
@media (max-width: 1500px) { .summary-strip,.toolbar,.table-tabs,.content-grid { margin-inline: 1.25rem; } }
@media (max-width: 1050px) { .table-tabs { grid-template-columns: repeat(2, 1fr); } .summary-strip { grid-template-columns: 1.4fr repeat(3, 1fr); } .content-grid { grid-template-columns: minmax(0, 1.2fr) minmax(320px, 1fr); } }
@media (max-width: 780px) { .topbar { align-items: flex-start; padding: 1rem; } .brand p { display: none; } .upload-button { padding: .65rem; font-size: .75rem; } .summary-strip,.toolbar,.table-tabs,.content-grid { margin-inline: .8rem; } .summary-strip { grid-template-columns: repeat(3, 1fr); } .file-summary { grid-column: 1 / -1; min-height: 90px; } .summary-stat { min-height: 86px; padding: 1rem; } .summary-stat strong { font-size: 1.1rem; } .content-grid { grid-template-columns: 1fr; } .detail-panel { position: static; } }
@media (max-width: 540px) { .brand-mark { width: 38px; height: 38px; } .brand h1 { max-width: 170px; font-size: .95rem; } .upload-button svg { display: none; } .toolbar { align-items: center; } .toolbar-title h2 { font-size: 1.05rem; } .sheet-picker { gap: .35rem; } .sheet-picker span { display: none; } .sheet-picker select { min-width: 135px; max-width: 155px; font-size: .75rem; } .table-tabs { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; padding-bottom: .3rem; } .table-tab { flex: 0 0 82%; scroll-snap-align: start; } .summary-stat { padding: .8rem .7rem; } .summary-stat span { font-size: .68rem; } .summary-stat strong { font-size: .95rem; } .summary-stat strong::after { display: block; margin-top: .15rem; } .item-card { grid-template-columns: 30px minmax(0, 1fr); padding: 1rem; } .item-index { width: 28px; height: 28px; } .item-money { grid-column: 2; align-items: start; } .item-money small { display: none; } .progress-track { grid-column: 2; } }
@media (prefers-reduced-motion: reduce) { *,*::before,*::after { scroll-behavior: auto !important; transition: none !important; animation-duration: .01ms !important; } }
</style>
