
import * as vscode from "vscode";
import fetch from "node-fetch";

const CURRENCIES = [
  { name: "USD", symbol: "$" },
  { name: "EUR", symbol: "€" },
  { name: "JPY", symbol: "¥" },
  { name: "GBP", symbol: "£" },
  { name: "AUD", symbol: "A$" },
  { name: "CAD", symbol: "C$" },
  { name: "CHF", symbol: "CHF" },
  { name: "CNY", symbol: "元" },
  { name: "HKD", symbol: "HK$" },
  { name: "NZD", symbol: "NZ$" },
  { name: "SEK", symbol: "kr" },
  { name: "KRW", symbol: "₩" },
  { name: "SGD", symbol: "S$" },
  { name: "NOK", symbol: "kr" },
  { name: "MXN", symbol: "$" },
  { name: "INR", symbol: "₹" },
  { name: "RUB", symbol: "₽" },
  { name: "ZAR", symbol: "R" },
  { name: "TRY", symbol: "₺" },
  { name: "BRL", symbol: "R$" },
  { name: "TWD", symbol: "NT$" },
  { name: "DKK", symbol: "kr" },
  { name: "PLN", symbol: "zł" },
  { name: "THB", symbol: "฿" },
  { name: "IDR", symbol: "Rp" },
  { name: "HUF", symbol: "Ft" },
  { name: "CZK", symbol: "Kč" },
  { name: "ILS", symbol: "₪" },
  { name: "CLP", symbol: "CLP$" },
  { name: "PHP", symbol: "₱" },
  { name: "AED", symbol: "د.إ" },
  { name: "SAR", symbol: "﷼" },
  { name: "MYR", symbol: "RM" },
  { name: "DOGE", symbol: "Đ" },
  { name: "HIVE", symbol: "H" },
];

type CurrencyObject = {
  name: string;
  symbol: string;
};

class LocalStorageService {
  static globalState: vscode.ExtensionContext["globalState"];

  static getCurrency() {
    const storedCurrency = this.globalState.get<string>("currency");
    if (storedCurrency) {
      return JSON.parse(storedCurrency);
    } else {
      return null;
    }
  }

  static updateCurrency(currencyToStore: CurrencyObject) {
    this.globalState.update("currency", JSON.stringify(currencyToStore));
  }
}

const CURRENCY_SELECTION = CURRENCIES.map(
  ({ name, symbol }) => `${name} ${symbol}`
);

let currency: CurrencyObject = CURRENCIES[0];
let hiveStatusBarItem: vscode.StatusBarItem;
let price: number;
let change: string;
let updatedSecondsAgo: number = 0;
let fetchIntervalId: NodeJS.Timeout | null;
let updateIntervalId: NodeJS.Timeout | null;

export function activate(context: vscode.ExtensionContext) {
  LocalStorageService.globalState = context.globalState;
  const storedCurrency = LocalStorageService.getCurrency();
  if (storedCurrency) {
    currency = storedCurrency;
  }

  hiveStatusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100
  );

  let disposable = vscode.commands.registerCommand(
    "hivecoin.setCurrency",
    () => {
      vscode.window.showQuickPick(CURRENCY_SELECTION).then((selection) => {
        if (selection) {
          currency =
            CURRENCIES.find(
              ({ name }) =>
                name === selection.substring(0, 3) ||
                name === selection.substring(0, 4)
            ) ?? currency;
          LocalStorageService.updateCurrency(currency);
          startMonitoring();
        }
      });
    }
  );

  context.subscriptions.push(disposable);
  startMonitoring();
}

const startMonitoring = () => {
  if (fetchIntervalId) {
    clearInterval(fetchIntervalId);
  }
  if (updateIntervalId) {
    clearInterval(updateIntervalId);
    updateIntervalId = null;
  }
  hiveStatusBarItem.show();
  if (currency.name === "HIVE") {
    hiveStatusBarItem.text = `$(account) 1 Đoge = 1 Đoge`;
  } else {
    hiveStatusBarItem.text = `$(account) Fetching Hive price...`;
    fetchHiveData();
    fetchIntervalId = setInterval(fetchHiveData, 30000);
  }
};

const fetchHiveData = async (): Promise<void> => {
  const response = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=hive&vs_currencies=${currency.name.toLowerCase()}&include_24hr_change=true&include_last_updated_at=true`
  );
  const { hive } = await response.json();
  price = hive[currency.name.toLowerCase()];
  const changeIn24h = hive[`${currency.name.toLowerCase()}_24h_change`];
  if (changeIn24h < 0) {
    change = changeIn24h.toFixed(2).toString();
  } else {
    change = `+${changeIn24h.toFixed(2).toString()}`;
  }
  updatedSecondsAgo = hive.last_updated_at;
  if (!updateIntervalId) {
    updateIntervalId = setInterval(updateStatusBarItem, 1000);
  }
};

const updateStatusBarItem = (): void => {
  if (price && change) {
    hiveStatusBarItem.text = `$(account) Hive is ${currency.symbol
      }${price} | ${change}% | ${getRelativeTime()}`;
  } else {
    hiveStatusBarItem.text = `$(account) wow, such error`;
  }
};

const getRelativeTime = (): string => {
  const seconds = Math.round(Date.now() / 1000 - updatedSecondsAgo);
  const minutes = Math.floor(seconds / 60);
  if (minutes) {
    const leftoverSeconds = seconds - minutes * 60;
    return `${minutes}m ${leftoverSeconds}s ago`;
  }
  if (seconds === 0) {
    return "just now";
  }
  return `${seconds}s ago`;
};

export function deactivate() {
  if (fetchIntervalId) {
    clearInterval(fetchIntervalId);
  }
  if (updateIntervalId) {
    clearInterval(updateIntervalId);
  }
}
