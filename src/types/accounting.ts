export interface BudgetPeriod {
  column: number;
  name: string;
  detail: string;
  amount: number;
}

export interface BudgetItem {
  id: string;
  rowNumber: number;
  name: string;
  detail: string;
  amount: number;
  total: number;
  periods: BudgetPeriod[];
}

export interface BudgetSummary {
  name: string;
  amount: number;
  total: number;
  periods: number[];
}

export interface BudgetTable {
  id: string;
  number: number;
  title: string;
  firstRow: number;
  items: BudgetItem[];
  summary: BudgetSummary;
}

export interface BudgetSheet {
  name: string;
  tables: BudgetTable[];
}

export interface ExpenseTransaction {
  id: string;
  itemId: string;
  amount: number;
  details: string[];
  createdAt: string;
}
