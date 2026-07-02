const fs = require('fs');
const path = require('path');

const filePath = 'd:/vscode/SIMPELUNYbackup/src/pages/ToolAdministration.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Fix the 'serials' variable declaration
content = content.replace(/const serials = data\.serial_numbers[\s\S]*?;/g, '');

// Fix formatEquipmentSpec calls
content = content.replace(/const finalSpec = formatEquipmentSpec\(serials, data\.Spesification \|\| selectedStockForClaim\.spesification \|\| ''\);/g, 
'const finalSpec = formatEquipmentSpec(data.purchase_year || \\'\\', data.procurement_type || \\'\\', data.Spesification || selectedStockForClaim.spesification || \\'\\');');

content = content.replace(/const finalSpec = formatEquipmentSpec\(serials, data\.Spesification \|\| ''\);/g,
'const finalSpec = formatEquipmentSpec(data.purchase_year || \\'\\', data.procurement_type || \\'\\', data.Spesification || \\'\\');');

// Add the procurement_type block
// Claim block:
const claimPurchaseBlock = /<label className=\"block text-sm font-bold mb-2\">\{getText\('Year of Purchase', 'Tahun Pembelian'\)\}<\/label>[\s]*<input \{\.\.\.claimForm\.register\('purchase_year'\)\} className=\"w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors\" placeholder=\"e\.g\. SN123, SN124, SN125\" \/>/;
content = content.replace(claimPurchaseBlock, \`<label className="block text-sm font-bold mb-2">{getText('Year of Purchase', 'Tahun Pembelian')}</label>
                                <input type="number" {...claimForm.register('purchase_year')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors" placeholder="YYYY" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-2">{getText('Procurement Type (Optional)', 'Jenis Pengadaan (Opsional)')}</label>
                                <input type="text" {...claimForm.register('procurement_type')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors" placeholder="e.g. Hibah, APBN" />\`);

// Edit block:
const editPurchaseBlock = /<label className=\"block text-sm font-bold mb-2\">\{getText\('Year of Purchase', 'Tahun Pembelian'\)\}<\/label>[\s]*<input[\s]*\{\.\.\.editForm\.register\('purchase_year'\)\}[\s]*className=\"w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none transition-colors\"[\s]*placeholder=\"e\.g\. SN123, SN124, SN125\"[\s]*\/>/;
content = content.replace(editPurchaseBlock, \`<label className="block text-sm font-bold mb-2">{getText('Year of Purchase', 'Tahun Pembelian')}</label>
                                <input type="number" {...editForm.register('purchase_year')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none transition-colors" placeholder="YYYY" />
                            </div>
                            <div>
                                <label className="block text-sm font-bold mb-2">{getText('Procurement Type (Optional)', 'Jenis Pengadaan (Opsional)')}</label>
                                <input type="text" {...editForm.register('procurement_type')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-amber-500 focus:outline-none transition-colors" placeholder="e.g. Hibah, APBN" />\`);

// Direct Add block:
const directAddPurchaseBlock = /<label className=\"block text-sm font-bold mb-2\">\{getText\('Year of Purchase', 'Tahun Pembelian'\)\}<\/label>[\s]*<input \{\.\.\.editForm\.register\('purchase_year'\)\} className=\"w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors\" placeholder=\"e\.g\. SN123, SN124, SN125\" \/>/;
content = content.replace(directAddPurchaseBlock, \`<label className="block text-sm font-bold mb-2">{getText('Year of Purchase', 'Tahun Pembelian')}</label>
                        <input type="number" {...editForm.register('purchase_year')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors" placeholder="YYYY" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold mb-2">{getText('Procurement Type (Optional)', 'Jenis Pengadaan (Opsional)')}</label>
                        <input type="text" {...editForm.register('procurement_type')} className="w-full px-4 py-2 border-2 border-gray-200 rounded-xl focus:border-green-500 focus:outline-none transition-colors" placeholder="e.g. Hibah, APBN" />\`);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Fixed ToolAdministration.tsx successfully.');
