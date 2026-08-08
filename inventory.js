const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DB_FILE = path.join(__dirname, 'inventory-db.json');

function seedData() {
  return {
    items: [],
    transactions: [],
  };
}

function loadData() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      return seedData();
    }
    const content = fs.readFileSync(DB_FILE, 'utf8');
    return content.trim() ? JSON.parse(content) : seedData();
  } catch (error) {
    console.error('Failed to read inventory data:', error.message);
    process.exit(1);
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (error) {
    console.error('Failed to save inventory data:', error.message);
    process.exit(1);
  }
}

function normalizeSku(sku) {
  return sku ? String(sku).trim().toUpperCase() : '';
}

function parseOptions(argv) {
  const options = {};
  let currentKey = null;

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) {
      continue;
    }
    currentKey = token.slice(2);
    if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
      options[currentKey] = argv[i + 1];
      i += 1;
    } else {
      options[currentKey] = true;
    }
  }
  return options;
}

function printHelp() {
  console.log(`Inventory & Stock Management CLI

Usage:
  node inventory.js <command> [options]

Commands:
  help                        Show this help text
  menu                        Open interactive inventory menu
  add-item                    Add a new inventory item
  update-item                 Update an existing item by SKU
  delete-item                 Delete an item by SKU
  list-items                  List all inventory items
  view-item                   View item details by SKU
  stock-in                    Receive stock by SKU
  stock-out                   Issue stock by SKU
  low-stock                  Show items at or below reorder level
  report                      Generate inventory reports

Add / update item options:
  --sku <sku>                 Item SKU (required)
  --name <name>               Item name
  --category <category>       Category or department
  --unit <unit>               Unit of measure (pcs, boxes, kg)
  --cost <cost>               Unit cost
  --reorder <reorder level>   Reorder threshold
  --quantity <quantity>       Starting quantity

Stock movement options:
  --sku <sku>                 SKU of item (required)
  --qty <quantity>            Quantity to add or remove (required)
  --ref <reference>           Reference code or source
  --note <note>               Optional note

Report options:
  --type <inventory|transactions|low-stock>
  --from <YYYY-MM-DD>         Start date for transaction reports
  --to <YYYY-MM-DD>           End date for transaction reports

Examples:
  node inventory.js add-item --sku P001 --name "Widget" --category Tools --unit pcs --cost 12.50 --reorder 5 --quantity 20
  node inventory.js stock-in --sku P001 --qty 15 --ref PURCHASE-101 --note "Restock"
  node inventory.js stock-out --sku P001 --qty 4 --ref SALE-501 --note "Customer order"
  node inventory.js report --type low-stock
`);
}

function formatCurrency(value) {
  return Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatDate(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function pad(str, width) {
  return String(str).padEnd(width, ' ');
}

function findItem(data, sku) {
  return data.items.find((item) => item.sku === normalizeSku(sku));
}

function addItem(data, opts) {
  const sku = normalizeSku(opts.sku);
  if (!sku) {
    console.error('ERROR: --sku is required for add-item');
    process.exit(1);
  }
  if (findItem(data, sku)) {
    console.error(`ERROR: Item with SKU ${sku} already exists.`);
    process.exit(1);
  }

  const item = {
    sku,
    name: opts.name ? String(opts.name).trim() : '',
    category: opts.category ? String(opts.category).trim() : '',
    unit: opts.unit ? String(opts.unit).trim() : 'pcs',
    unitCost: opts.cost ? Number(opts.cost) : 0,
    reorderLevel: opts.reorder ? Number(opts.reorder) : 0,
    quantity: opts.quantity ? Number(opts.quantity) : 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  if (!item.name) {
    console.error('ERROR: --name is required for add-item');
    process.exit(1);
  }

  if (Number.isNaN(item.unitCost) || item.unitCost < 0) {
    console.error('ERROR: --cost must be a valid non-negative number');
    process.exit(1);
  }
  if (Number.isNaN(item.reorderLevel) || item.reorderLevel < 0) {
    console.error('ERROR: --reorder must be a valid non-negative integer');
    process.exit(1);
  }
  if (Number.isNaN(item.quantity) || item.quantity < 0) {
    console.error('ERROR: --quantity must be a valid non-negative number');
    process.exit(1);
  }

  data.items.push(item);
  saveData(data);
  console.log(`Added item ${sku} (${item.name}) with quantity ${item.quantity}.`);
}

function updateItem(data, opts) {
  const sku = normalizeSku(opts.sku);
  if (!sku) {
    console.error('ERROR: --sku is required for update-item');
    process.exit(1);
  }
  const item = findItem(data, sku);
  if (!item) {
    console.error(`ERROR: Item with SKU ${sku} not found.`);
    process.exit(1);
  }

  const prev = { ...item };
  if (opts.name) item.name = String(opts.name).trim();
  if (opts.category) item.category = String(opts.category).trim();
  if (opts.unit) item.unit = String(opts.unit).trim();
  if (opts.cost !== undefined) {
    const cost = Number(opts.cost);
    if (Number.isNaN(cost) || cost < 0) {
      console.error('ERROR: --cost must be a valid non-negative number');
      process.exit(1);
    }
    item.unitCost = cost;
  }
  if (opts.reorder !== undefined) {
    const reorder = Number(opts.reorder);
    if (Number.isNaN(reorder) || reorder < 0) {
      console.error('ERROR: --reorder must be a valid non-negative number');
      process.exit(1);
    }
    item.reorderLevel = reorder;
  }
  if (opts.quantity !== undefined) {
    const quantity = Number(opts.quantity);
    if (Number.isNaN(quantity) || quantity < 0) {
      console.error('ERROR: --quantity must be a valid non-negative number');
      process.exit(1);
    }
    item.quantity = quantity;
  }
  item.updatedAt = new Date().toISOString();
  saveData(data);
  console.log(`Updated item ${sku}.`);
  console.log(`Before: ${prev.quantity} ${prev.unit}`);
  console.log(`After:  ${item.quantity} ${item.unit}`);
}

function deleteItem(data, opts) {
  const sku = normalizeSku(opts.sku);
  if (!sku) {
    console.error('ERROR: --sku is required for delete-item');
    process.exit(1);
  }
  const index = data.items.findIndex((item) => item.sku === sku);
  if (index === -1) {
    console.error(`ERROR: Item with SKU ${sku} not found.`);
    process.exit(1);
  }
  const [removed] = data.items.splice(index, 1);
  saveData(data);
  console.log(`Deleted item ${removed.sku} (${removed.name}).`);
}

function listItems(data) {
  if (data.items.length === 0) {
    console.log('No inventory items found. Add items with add-item.');
    return;
  }
  const headers = ['SKU', 'Name', 'Qty', 'Unit', 'Cost', 'Reorder', 'Category'];
  console.log(headers.map((h, idx) => pad(h, [10, 24, 6, 8, 10, 9, 18][idx])).join('  '));
  console.log('-'.repeat(85));
  data.items.forEach((item) => {
    console.log([
      pad(item.sku, 10),
      pad(item.name, 24),
      pad(item.quantity, 6),
      pad(item.unit, 8),
      pad(formatCurrency(item.unitCost), 10),
      pad(item.reorderLevel, 9),
      pad(item.category, 18),
    ].join('  '));
  });
}

function viewItem(data, opts) {
  const sku = normalizeSku(opts.sku);
  if (!sku) {
    console.error('ERROR: --sku is required for view-item');
    process.exit(1);
  }
  const item = findItem(data, sku);
  if (!item) {
    console.error(`ERROR: Item with SKU ${sku} not found.`);
    process.exit(1);
  }
  console.log(`SKU:          ${item.sku}`);
  console.log(`Name:         ${item.name}`);
  console.log(`Category:     ${item.category}`);
  console.log(`Unit:         ${item.unit}`);
  console.log(`Unit cost:    ${formatCurrency(item.unitCost)}`);
  console.log(`Quantity:     ${item.quantity}`);
  console.log(`Reorder level:${item.reorderLevel}`);
  console.log(`Created at:   ${formatDate(item.createdAt)}`);
  console.log(`Updated at:   ${formatDate(item.updatedAt)}`);
  const onHandValue = item.unitCost * item.quantity;
  console.log(`Stock value:  ${formatCurrency(onHandValue)}`);

  const recent = data.transactions
    .filter((txn) => txn.sku === sku)
    .slice(-10)
    .reverse();

  console.log('\nRecent transactions:');
  if (recent.length === 0) {
    console.log('  No transactions for this item.');
    return;
  }
  recent.forEach((txn) => {
    console.log(`  [${txn.date}] ${txn.type} ${txn.quantity} ${item.unit} (${txn.reference || 'no ref'}) ${txn.note || ''}`);
  });
}

function recordTransaction(data, sku, type, quantity, opts) {
  const item = findItem(data, sku);
  if (!item) {
    console.error(`ERROR: Item with SKU ${sku} not found.`);
    process.exit(1);
  }
  if (Number.isNaN(quantity) || quantity <= 0) {
    console.error('ERROR: --qty must be a valid positive number');
    process.exit(1);
  }
  const beforeQty = item.quantity;
  const afterQty = type === 'IN' ? beforeQty + quantity : beforeQty - quantity;
  if (type === 'OUT' && afterQty < 0) {
    console.error(`ERROR: Cannot remove ${quantity} from ${sku}; only ${beforeQty} available.`);
    process.exit(1);
  }
  item.quantity = afterQty;
  item.updatedAt = new Date().toISOString();
  const transaction = {
    id: data.transactions.length + 1,
    sku,
    type,
    quantity,
    date: new Date().toISOString().slice(0, 19).replace('T', ' '),
    reference: opts.ref ? String(opts.ref).trim() : '',
    note: opts.note ? String(opts.note).trim() : '',
    beforeQuantity: beforeQty,
    afterQuantity: afterQty,
  };
  data.transactions.push(transaction);
  saveData(data);
  console.log(`${type === 'IN' ? 'Received' : 'Issued'} ${quantity} ${item.unit} for ${sku}.`);
  console.log(`Before: ${beforeQty}, After: ${afterQty}`);
}

function stockIn(data, opts) {
  const sku = normalizeSku(opts.sku);
  if (!sku) {
    console.error('ERROR: --sku is required for stock-in');
    process.exit(1);
  }
  if (!opts.qty) {
    console.error('ERROR: --qty is required for stock-in');
    process.exit(1);
  }
  recordTransaction(data, sku, 'IN', Number(opts.qty), opts);
}

function stockOut(data, opts) {
  const sku = normalizeSku(opts.sku);
  if (!sku) {
    console.error('ERROR: --sku is required for stock-out');
    process.exit(1);
  }
  if (!opts.qty) {
    console.error('ERROR: --qty is required for stock-out');
    process.exit(1);
  }
  recordTransaction(data, sku, 'OUT', Number(opts.qty), opts);
}

function printLowStock(data) {
  const low = data.items.filter((item) => item.quantity <= item.reorderLevel);
  if (low.length === 0) {
    console.log('All items are above their reorder levels.');
    return;
  }
  console.log('Low stock items:');
  console.log(pad('SKU', 10) + '  ' + pad('Name', 24) + '  ' + pad('Qty', 6) + '  ' + pad('Reorder', 8));
  console.log('-'.repeat(55));
  low.forEach((item) => console.log(`${pad(item.sku, 10)}  ${pad(item.name, 24)}  ${pad(item.quantity, 6)}  ${pad(item.reorderLevel, 8)}`));
}

function parseDateRange(opts) {
  let from = opts.from ? new Date(opts.from) : null;
  let to = opts.to ? new Date(opts.to) : null;

  if (from && Number.isNaN(from.getTime())) {
    console.error('ERROR: --from must be a valid date (YYYY-MM-DD)');
    process.exit(1);
  }
  if (to && Number.isNaN(to.getTime())) {
    console.error('ERROR: --to must be a valid date (YYYY-MM-DD)');
    process.exit(1);
  }
  if (to) {
    to.setHours(23, 59, 59, 999);
  }
  return { from, to };
}

function report(data, opts) {
  const type = opts.type || 'inventory';
  if (type === 'inventory') {
    listItems(data);
    return;
  }
  if (type === 'low-stock') {
    printLowStock(data);
    return;
  }
  if (type === 'transactions') {
    const range = parseDateRange(opts);
    const transactions = data.transactions
      .filter((txn) => {
        const txnDate = new Date(txn.date);
        if (range.from && txnDate < range.from) return false;
        if (range.to && txnDate > range.to) return false;
        return true;
      })
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (transactions.length === 0) {
      console.log('No transactions found for the selected date range.');
      return;
    }
    console.log(`Transactions (${range.from ? formatDate(range.from) : 'start'} to ${range.to ? formatDate(range.to) : 'end'}):`);
    console.log(pad('Date', 20) + pad('SKU', 10) + pad('Type', 8) + pad('Qty', 6) + pad('Before', 8) + pad('After', 7) + '  Reference  Note');
    console.log('-'.repeat(95));
    transactions.forEach((txn) => {
      console.log(
        pad(txn.date, 20) +
        pad(txn.sku, 10) +
        pad(txn.type, 8) +
        pad(txn.quantity, 6) +
        pad(txn.beforeQuantity, 8) +
        pad(txn.afterQuantity, 7) +
        '  ' + pad(txn.reference || '-', 14) +
        pad(txn.note || '-', 20)
      );
    });
    return;
  }
  console.error('ERROR: Unknown report type. Use inventory, transactions, or low-stock.');
  process.exit(1);
}

function ensureDataFile() {
  if (!fs.existsSync(DB_FILE)) {
    saveData(seedData());
  }
}

function promptQuestion(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function interactiveMenu() {
  ensureDataFile();
  const data = loadData();

  while (true) {
    console.log('\nInventory Management Menu');
    console.log('1) Add item');
    console.log('2) Update item');
    console.log('3) Delete item');
    console.log('4) List items');
    console.log('5) View item');
    console.log('6) Stock in');
    console.log('7) Stock out');
    console.log('8) Low-stock alerts');
    console.log('9) Transaction report');
    console.log('0) Exit');

    const choice = await promptQuestion('Select an option: ');
    switch (choice) {
      case '1': {
        const sku = normalizeSku(await promptQuestion('SKU: '));
        const name = await promptQuestion('Name: ');
        const category = await promptQuestion('Category: ');
        const unit = await promptQuestion('Unit (pcs): ') || 'pcs';
        const cost = await promptQuestion('Unit cost: ');
        const reorder = await promptQuestion('Reorder level: ');
        const quantity = await promptQuestion('Quantity: ');
        addItem(data, { sku, name, category, unit, cost, reorder, quantity });
        break;
      }
      case '2': {
        const sku = normalizeSku(await promptQuestion('SKU: '));
        const name = await promptQuestion('Name (leave blank to skip): ');
        const category = await promptQuestion('Category (leave blank to skip): ');
        const unit = await promptQuestion('Unit (leave blank to skip): ');
        const cost = await promptQuestion('Unit cost (leave blank to skip): ');
        const reorder = await promptQuestion('Reorder level (leave blank to skip): ');
        const quantity = await promptQuestion('Quantity (leave blank to skip): ');
        updateItem(data, {
          sku,
          ...(name && { name }),
          ...(category && { category }),
          ...(unit && { unit }),
          ...(cost && { cost }),
          ...(reorder && { reorder }),
          ...(quantity && { quantity }),
        });
        break;
      }
      case '3': {
        const sku = normalizeSku(await promptQuestion('SKU: '));
        deleteItem(data, { sku });
        break;
      }
      case '4':
        listItems(data);
        break;
      case '5': {
        const sku = normalizeSku(await promptQuestion('SKU: '));
        viewItem(data, { sku });
        break;
      }
      case '6': {
        const sku = normalizeSku(await promptQuestion('SKU: '));
        const qty = await promptQuestion('Quantity to receive: ');
        const ref = await promptQuestion('Reference (optional): ');
        const note = await promptQuestion('Note (optional): ');
        stockIn(data, { sku, qty, ref, note });
        break;
      }
      case '7': {
        const sku = normalizeSku(await promptQuestion('SKU: '));
        const qty = await promptQuestion('Quantity to issue: ');
        const ref = await promptQuestion('Reference (optional): ');
        const note = await promptQuestion('Note (optional): ');
        stockOut(data, { sku, qty, ref, note });
        break;
      }
      case '8':
        printLowStock(data);
        break;
      case '9': {
        const from = await promptQuestion('From date (YYYY-MM-DD, optional): ');
        const to = await promptQuestion('To date (YYYY-MM-DD, optional): ');
        report(data, { type: 'transactions', from: from || undefined, to: to || undefined });
        break;
      }
      case '0':
        console.log('Goodbye!');
        process.exit(0);
      default:
        console.log('Invalid option. Please choose a number from 0 to 9.');
    }
  }
}

async function main() {
  const [,, command, ...args] = process.argv;
  const options = parseOptions(args);

  if (!command || command === 'help') {
    printHelp();
    return;
  }

  if (command === 'menu') {
    await interactiveMenu();
    return;
  }

  const data = loadData();
  switch (command) {
    case 'add-item':
      addItem(data, options);
      break;
    case 'update-item':
      updateItem(data, options);
      break;
    case 'delete-item':
      deleteItem(data, options);
      break;
    case 'list-items':
      listItems(data);
      break;
    case 'view-item':
      viewItem(data, options);
      break;
    case 'stock-in':
      stockIn(data, options);
      break;
    case 'stock-out':
      stockOut(data, options);
      break;
    case 'low-stock':
      printLowStock(data);
      break;
    case 'report':
      report(data, options);
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printHelp();
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error.message);
  process.exit(1);
});
