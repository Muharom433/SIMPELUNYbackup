const fs = require('fs');
const path = require('path');

const base = 'd:/vscode/SIMPELUNYbackup/src/pages';
const files = ['ToolAdministration.tsx', 'ToolLending.tsx', 'RoomManagement.tsx', 'RoomInfo.tsx'];

for (const file of files) {
  let content = fs.readFileSync(path.join(base, file), 'utf8');

  // Replace destructurings
  content = content.replace(/const \{ serials, specs \} = parseEquipmentSpec/g, 'const { purchaseYear, procurementType, specs } = parseEquipmentSpec');
  content = content.replace(/const \{ serials \} = parseEquipmentSpec/g, 'const { purchaseYear, procurementType } = parseEquipmentSpec');

  if (file === 'ToolAdministration.tsx') {
    // Replace labels
    content = content.replace(/'Equipment Code', 'Kode Peralatan'/g, '\'NUP Number\', \'NOMOR NUP\'');
    
    // In handleAddEquipment / handleEditEquipment
    content = content.replace(/serial_numbers: (?:data\.)?serial_numbers \?\? '',?/g, 'purchase_year: data.purchase_year ?? \'\', procurement_type: data.procurement_type ?? \'\',');
    
    // Formatting when saving
    content = content.replace(/const formattedSpec = formatEquipmentSpec\(\s*(?:data\.)?serial_numbers\s*\?\s*(?:data\.)?serial_numbers\.split\(\/,\/g\)\.map\(s => s\.trim\(\)\)\.filter\(Boolean\)\s*:\s*\[\],\s*(?:data\.)?Spesification\s*\|\|\s*''\s*\);/g, 
    'const formattedSpec = formatEquipmentSpec(data.purchase_year || \'\', data.procurement_type || \'\', data.Spesification || \'\');');
    
    // Modal open prep
    content = content.replace(/claimForm\.reset\(\{[\s\S]*?\}\);/, (match) => {
        return match.replace(/serial_numbers: '',/, 'purchase_year: \'\',\n                procurement_type: \'\',');
    });

    content = content.replace(/editForm\.reset\(\{[\s\S]*?\}\);/, (match) => {
        let m = match.replace(/serial_numbers: serials\.join\(\', \'\),\n/g, '');
        m = m.replace(/Spesification: specs,/, 'Spesification: specs,\n                purchase_year: purchaseYear,\n                procurement_type: procurementType,');
        return m;
    });
    
    // UI rendering replacements
    // Serial Numbers (Optional, separate with commas) -> Year of Purchase
    content = content.replace(/getText\('Serial Numbers \(Optional, separate with commas\)', 'Nomor Seri \(Opsional, pisahkan dengan koma\)'\)/g, 
    'getText(\'Year of Purchase\', \'Tahun Pembelian\')');
    
    // serial_numbers input placeholder
    content = content.replace(/placeholder=\"SN-001, SN-002\"/g, 'placeholder=\"2024\" type=\"number\"');
    content = content.replace(/\{\.\.\.claimForm\.register\('serial_numbers'\)\}/g, '{...claimForm.register(\'purchase_year\')}');
    content = content.replace(/\{\.\.\.editForm\.register\('serial_numbers'\)\}/g, '{...editForm.register(\'purchase_year\')}');
    content = content.replace(/id=\"serial_numbers\"/g, 'id=\"purchase_year\"');

    // Add Procurement Type UI just below Year of Purchase
    // I will use regex to find the block for purchase_year and duplicate it for procurement_type
    const uiBlockRegex = /(<div[^>]*>[\s]*<label[^>]*>\{getText\('Year of Purchase', 'Tahun Pembelian'\)\}<\/label>[\s]*<div[^>]*>[\s]*<Hash[^>]*\/>[\s]*<\/div>[\s]*<input[^>]*id=\"purchase_year\"[\s\S]*?<\/div>)/g;
    content = content.replace(uiBlockRegex, (match) => {
        let procurementBlock = match.replace(/'Year of Purchase', 'Tahun Pembelian'/g, '\'Procurement Type (Optional)\', \'Jenis Pengadaan (Opsional)\'');
        procurementBlock = procurementBlock.replace(/id=\"purchase_year\"/g, 'id=\"procurement_type\"');
        procurementBlock = procurementBlock.replace(/purchase_year/g, 'procurement_type');
        procurementBlock = procurementBlock.replace(/placeholder=\"2024\" type=\"number\"/, 'placeholder=\"e.g. Hibah, APBN\" type=\"text\"');
        return match + '\n' + procurementBlock;
    });

    // Detail UI (Specifications & Serials -> Specifications & Details)
    content = content.replace(/getText\('Specifications & Serials', 'Spesifikasi & Nomor Seri'\)/g, 'getText(\'Specifications & Details\', \'Spesifikasi & Detail\')');
    
    // Replace the Serial Numbers display in Detail Modal
    const displaySerialRegex = /<p className=\"text-xs text-gray-500 mb-1\">\{getText\('Serial Numbers:', 'Nomor Seri:'\)\}<\/p>[\s]*<div className=\"flex flex-wrap gap-2\">[\s]*\{serials\.length > 0 \? \([\s]*serials\.map\(\(sn: string, idx: number\) => \([\s\S]*?\) : \([\s]*<span className=\"text-sm text-gray-400 italic\">-<\/span>[\s]*\)\}[\s]*<\/div>/g;
    
    content = content.replace(displaySerialRegex, 
    `<p className=\"text-xs text-gray-500 mb-1\">{getText('Purchase Year & Procurement:', 'Tahun Pembelian & Pengadaan:')}</p>
    <div className=\"text-sm text-gray-800 font-medium mb-3\">
        {purchaseYear ? <div className="mb-1">{getText('Year:', 'Tahun:')} {purchaseYear}</div> : null}
        {procurementType ? <div>{getText('Type:', 'Jenis:')} {procurementType}</div> : null}
        {!purchaseYear && !procurementType && <span className="text-gray-400 italic">-</span>}
    </div>`);

    // In Equipment Table, expand details UI:
    const tableSerialRegex = /<label className=\"block text-gray-500 mb-1\">\{getText\('Serial Numbers:', 'Nomor Seri:'\)\}<\/label>[\s]*<div className=\"flex flex-wrap gap-1\">[\s]*\{serials\.length > 0 \? \([\s]*serials\.map\(\(sn: string, idx: number\) => \([\s\S]*?\) : \([\s]*<span className=\"text-gray-400 italic\">-<\/span>[\s]*\)\}[\s]*<\/div>/g;
    
    content = content.replace(tableSerialRegex,
    `<label className=\"block text-gray-500 mb-1\">{getText('Purchase Year & Procurement:', 'Tahun Pembelian & Pengadaan:')}</label>
    <div className=\"text-sm font-medium text-gray-800\">
        {purchaseYear ? <div className="mb-1">{getText('Year:', 'Tahun:')} {purchaseYear}</div> : null}
        {procurementType ? <div>{getText('Type:', 'Jenis:')} {procurementType}</div> : null}
        {!purchaseYear && !procurementType && <span className="text-gray-400 italic">-</span>}
    </div>`);

  } else {
    // Other files
    content = content.replace(/\{getText\('Serial Numbers', 'Nomor Seri'\)\}/g, '{getText(\'Purchase Year & Procurement\', \'Tahun Pembelian & Pengadaan\')}');
    content = content.replace(/\{getText\('Serial Numbers:', 'Nomor Seri:'\)\}/g, '{getText(\'Purchase Year & Procurement:\', \'Tahun Pembelian & Pengadaan:\')}');
    
    const mapRegex = /\{serials\.length > 0 \? \([\s]*serials\.map\(\(sn: string, idx: number\) => \([\s\S]*?\) : \([\s]*<span className=\"text-[a-zA-Z0-9\-]+ text-gray-[0-9]+ italic(?: mb-2)?\">-<\/span>[\s]*\)\}/g;
    content = content.replace(mapRegex, 
    `{purchaseYear || procurementType ? (
        <div className="text-sm font-medium text-gray-800">
            {purchaseYear && <div>{purchaseYear}</div>}
            {procurementType && <div>{procurementType}</div>}
        </div>
    ) : (
        <span className="text-gray-400 italic">-</span>
    )}`);
  }

  fs.writeFileSync(path.join(base, file), content, 'utf8');
}
console.log('Replacements completed successfully.');
