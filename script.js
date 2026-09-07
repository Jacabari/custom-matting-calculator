/**
 * Commercial Matting Estimator & Pricing Calculator
 * Pure Vanilla JavaScript (ES6) Engine
 * Implements Rules 1-7, Base Material Costs, Adhesive Bonding (+5% Waste),
 * Edging Reducers, and Philippine Regional Margin Brackets.
 */

// 1. Data Specifications & Constants
const MAT_SPECS = {
  heavy_8250: {
    id: 'heavy_8250',
    name: 'Heavy Traffic 8250',
    standardWidth: 3,
    standardLength: 20,
    costPerSqFt: 535.30,
    desc: 'Unbacked open vinyl z-web construction for extreme exterior entrances'
  },
  medium_6050: {
    id: 'medium_6050',
    name: 'Medium Traffic 6050',
    standardWidth: 3,
    standardLength: 78,
    costPerSqFt: 279.18,
    desc: 'Backed vinyl coiled loop matting trapping dirt and moisture indoors'
  },
  carpet_3100_3: {
    id: 'carpet_3100_3',
    name: 'Carpet 3100 (3 ft Width)',
    standardWidth: 3,
    standardLength: 60,
    costPerSqFt: 333.89,
    desc: 'Dual-fiber ribbed carpet matting in 3 ft master roll format'
  },
  carpet_3100_4: {
    id: 'carpet_3100_4',
    name: 'Carpet 3100 (4 ft Width)',
    standardWidth: 4,
    standardLength: 60,
    costPerSqFt: 302.84,
    desc: 'Dual-fiber ribbed carpet matting in 4 ft wide architectural roll'
  },
  wet_area_3: {
    id: 'wet_area_3',
    name: 'Wet Area Mat',
    standardWidth: 3,
    standardLength: 40,
    costPerSqFt: 381.58,
    desc: 'Rubber-backed wet drainage matting. Rule 7 strictly applies.'
  }
};

const COST_PERCENTAGES = {
  Luzon: { SRP: 0.73, B1: 0.76, B2: 0.79, B3: 0.82, B4: 0.85 },
  VisMin: { SRP: 0.70, B1: 0.73, B2: 0.76, B3: 0.79, B4: 0.82 }
};

const BRACKET_LABELS = {
  SRP: 'Suggested Retail Price (SRP)',
  B1: 'Bracket 1 (B1)',
  B2: 'Bracket 2 (B2)',
  B3: 'Bracket 3 (B3)',
  B4: 'Bracket 4 (B4)'
};

// Application & Material Parameters
const ADHESIVE_COST_PER_LN_FT = 18.62;
const ADHESIVE_WASTE_FACTOR = 1.05; // +5% waste factor
const EDGING_LOW_PROFILE_COST = 70.79;
const EDGING_HIGH_PROFILE_COST = 204.51;
const FIXED_LABOR_COST = 100.00; // ₱100.00 per job order
const VAT_RATE = 0.12; // Mandatory 12% Philippine VAT
const MIN_QUANTITY = 1;
const MAX_QUANTITY = 1000;

// Application State
const state = {
  matType: 'heavy_8250',
  width: 5,
  length: 12,
  quantity: 1,
  useAdhesive: true,
  edgingSides: 'four_sides', // 'none' | 'two_sides' | 'four_sides'
  edgingType: 'low_profile', // 'none' | 'low_profile' | 'high_profile'
  region: 'Luzon',           // 'Luzon' | 'VisMin'
  bracket: 'SRP',            // 'SRP' | 'B1' | 'B2' | 'B3' | 'B4'
  hideCosts: false,
  isAdmin: false,            // Controls access to internal cost breakdowns and admin settings
  preparedByName: '',
  lockedDocNumber: null,
  activeDocType: null
};

// Administrative Authentication
const ADMIN_PASSWORD = 'grb123';
let pendingAdminAction = null;

// 2. Format Currency (PHP)
function formatPHP(num) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num || 0);
}

// 3. Calculation Core Engine
function calculateOrder(input) {
  const { matType, width, length, quantity, edgingType, edgingSides, region, bracket, useAdhesive } = input;
  const spec = MAT_SPECS[matType];

  const res = {
    matType, width, length, quantity, edgingType, edgingSides, region, bracket, useAdhesive,
    cols: 1, rows: 1, roundedLength: 0, activeRule: '', ruleDescription: '',
    seamAdhesiveLength: 0, edgingLength: 0, edgingAdhesiveLength: 0,
    totalAdhesiveLength: 0, adhesiveLengthWithWaste: 0,
    
    // Per single unit
    unitMattingCost: 0, unitSeamAdhesiveCost: 0, unitEdgingCost: 0, unitEdgingAdhesiveCost: 0,
    unitProductionCost: 0, unitSellingPriceExclVat: 0, unitSellingPriceIncVat: 0,
    
    // Across full order quantity
    mattingCost: 0, seamAdhesiveCost: 0, edgingCost: 0, edgingAdhesiveCost: 0, adhesiveCost: 0,
    laborCost: FIXED_LABOR_COST,
    totalCost: 0,
    costPercentage: COST_PERCENTAGES[region]?.[bracket] || 0.73,
    sellingPriceExclVat: 0, vatAmount: 0, finalSellingPrice: 0,
    isValid: true, errorMessage: ''
  };

  if (!spec) {
    res.isValid = false; res.errorMessage = 'Invalid mat type selected.'; return res;
  }
  if (width <= 0 || length <= 0 || isNaN(width) || isNaN(length)) {
    res.isValid = false; res.errorMessage = 'Width and length must be numbers greater than zero.'; return res;
  }
  if (!Number.isFinite(quantity) || !Number.isInteger(quantity) || quantity < MIN_QUANTITY) {
    res.isValid = false; res.errorMessage = `Quantity must be an integer of at least ${MIN_QUANTITY}.`; return res;
  }
  if (quantity > MAX_QUANTITY) {
    res.isValid = false; res.errorMessage = `Quantity cannot exceed ${MAX_QUANTITY} units.`; return res;
  }

  // Rule 7: Wet Area Mat Special Exception
  if (matType === 'wet_area_3') {
    if (width > 3) {
      res.isValid = false;
      res.errorMessage = 'Rule 7: Wet Area Mat cannot exceed 3 ft width limit.';
      return res;
    }
    if (length > 10) {
      res.isValid = false;
      res.errorMessage = 'Rule 7: Wet Area Mat custom length cannot exceed 10 ft limit.';
      return res;
    }

    // Allowable standard chargeable lengths strictly: 2 ft, 4 ft, 8 ft, 10 ft
    const allowableLengths = [2, 4, 8, 10];
    let charged = 10;
    for (const std of allowableLengths) {
      if (length <= std) {
        charged = std;
        break;
      }
    }
    res.roundedLength = charged;
    res.cols = 1;
    res.rows = 1;
    res.activeRule = 'Rule 7: Wet Area Mat Exception (3 ft x 40 ft)';
    res.ruleDescription = `Custom length of ${length.toFixed(1)} ft is rounded UP to ${charged}.0 ft chargeable standard cut. Leftover cuts are non-reusable. No seam adhesive or perimeter edging applied.`;

    // Charged full standard width (3 ft) * charged length
    res.unitMattingCost = (3 * res.roundedLength) * spec.costPerSqFt;

    // Zero adhesive & edging per Rule 7
    res.seamAdhesiveLength = 0;
    res.edgingLength = 0;
    res.edgingAdhesiveLength = 0;
  } else {
    // Standard Matting: Rules 1 to 6
    res.cols = Math.ceil(width / spec.standardWidth);
    res.rows = Math.ceil(length / spec.standardLength);

    const isWidthExceeded = width > spec.standardWidth;
    const isLengthExceeded = length > spec.standardLength;

    // Seam calculations
    const longSeams = res.cols > 1 ? (res.cols - 1) * length : 0;
    const transSeams = res.rows > 1 ? (res.rows - 1) * width : 0;
    res.seamAdhesiveLength = useAdhesive ? (longSeams + transSeams) : 0;

    // Edging calculations
    if (edgingType === 'none' || edgingSides === 'none') {
      res.edgingLength = 0;
    } else if (edgingSides === 'four_sides') {
      res.edgingLength = (2 * width) + (2 * length);
    } else if (edgingSides === 'two_sides') {
      res.edgingLength = 2 * width;
    }
    res.edgingAdhesiveLength = (useAdhesive && edgingType !== 'none') ? res.edgingLength : 0;

    // Rule categorization
    if (isWidthExceeded && isLengthExceeded) {
      if (edgingSides === 'four_sides' && edgingType !== 'none') {
        res.activeRule = 'Rule 5: Oversized Width & Length (Four Sides Edging)';
        res.ruleDescription = `Area exceeds roll width (${spec.standardWidth} ft) & length (${spec.standardLength} ft). Longitudinal & transverse seams bonded. Perimeter edging on all 4 sides.`;
      } else if (edgingSides === 'two_sides' && edgingType !== 'none') {
        res.activeRule = 'Rule 6: Oversized Width & Length (Two Sides Edging - Width Only)';
        res.ruleDescription = `Area exceeds roll width & length. Multiple panels bonded along seams. Edging applied strictly along both width edges (${(2 * width).toFixed(1)} ft).`;
      } else {
        res.activeRule = 'Rule 4: Oversized Width & Length (No Edging)';
        res.ruleDescription = `Area exceeds roll width & length. Multiple panels bonded along length and width seams. No perimeter edging bevel.`;
      }
    } else if (isWidthExceeded) {
      if (edgingSides === 'four_sides' && edgingType !== 'none') {
        res.activeRule = 'Rule 2: Custom Width Exceeds Standard Size (Four Sides Edging)';
        res.ruleDescription = `Width (${width.toFixed(1)} ft) exceeds roll width (${spec.standardWidth} ft). Seam adhesive applied along ${length.toFixed(1)} ft join. Edging applied on all 4 outer sides.`;
      } else if (edgingSides === 'two_sides' && edgingType !== 'none') {
        res.activeRule = 'Rule 3: Custom Width Exceeds Standard Size (Two Sides Edging - Width Only)';
        res.ruleDescription = `Width exceeds roll width. Panels bonded along seam. Edging applied along the 2 width sides only (${(2 * width).toFixed(1)} ft).`;
      } else {
        res.activeRule = 'Rule 1: Custom Width Exceeds Standard Size (No Edging)';
        res.ruleDescription = `Width exceeds roll width. Panels bonded with seam adhesive along joining length. No perimeter edging bevel applied.`;
      }
    } else {
      res.activeRule = 'Standard Roll Cut';
      res.ruleDescription = `Dimensions fit within standard master roll width (${spec.standardWidth} ft). Single seamless continuous panel.`;
    }

    res.unitMattingCost = width * length * spec.costPerSqFt;
  }

  // Adhesive calculations with +5% waste factor
  res.totalAdhesiveLength = res.seamAdhesiveLength + res.edgingAdhesiveLength;
  res.adhesiveLengthWithWaste = res.totalAdhesiveLength * ADHESIVE_WASTE_FACTOR;

  // Single unit accessory costs
  const edgingRate = edgingType === 'low_profile' ? EDGING_LOW_PROFILE_COST : edgingType === 'high_profile' ? EDGING_HIGH_PROFILE_COST : 0;
  res.unitEdgingCost = res.edgingLength * edgingRate;
  res.unitSeamAdhesiveCost = res.seamAdhesiveLength * ADHESIVE_WASTE_FACTOR * ADHESIVE_COST_PER_LN_FT;
  res.unitEdgingAdhesiveCost = res.edgingAdhesiveLength * ADHESIVE_WASTE_FACTOR * ADHESIVE_COST_PER_LN_FT;
  res.unitProductionCost = res.unitMattingCost + res.unitSeamAdhesiveCost + res.unitEdgingCost + res.unitEdgingAdhesiveCost;

  // Order totals
  res.mattingCost = res.unitMattingCost * quantity;
  res.seamAdhesiveCost = res.unitSeamAdhesiveCost * quantity;
  res.edgingCost = res.unitEdgingCost * quantity;
  res.edgingAdhesiveCost = res.unitEdgingAdhesiveCost * quantity;
  res.adhesiveCost = res.seamAdhesiveCost + res.edgingAdhesiveCost;
  res.laborCost = FIXED_LABOR_COST; // Fixed ₱100.00 per job order

  // Direct Total Cost
  res.totalCost = res.mattingCost + res.seamAdhesiveCost + res.edgingCost + res.edgingAdhesiveCost + res.laborCost;

  // Commercial Pricing: Selling Price = (Final Total Cost / Cost Percentage) * 1.12
  if (res.costPercentage > 0) {
    res.sellingPriceExclVat = res.totalCost / res.costPercentage;
    res.vatAmount = res.sellingPriceExclVat * VAT_RATE;
    res.finalSellingPrice = res.sellingPriceExclVat * (1 + VAT_RATE);

    res.unitSellingPriceExclVat = res.sellingPriceExclVat / quantity;
    res.unitSellingPriceIncVat = res.finalSellingPrice / quantity;
  }

  res.orderAdhesiveLength = res.adhesiveLengthWithWaste * quantity;
  res.orderEdgingLength = res.edgingLength * quantity;
  res.orderSquareFeet = width * length * quantity;

  return res;
}

// 4. Blueprint Canvas Rendering (Dynamic SVG)
function renderBlueprint(calc) {
  const container = document.getElementById('blueprint-canvas-container');
  const scaleTag = document.getElementById('blueprint-scale-tag');

  if (!calc.isValid || calc.width <= 0 || calc.length <= 0) {
    scaleTag.textContent = 'Scale: N/A';
    container.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:12px; padding:2rem 0;">Dimension constraint prevents layout preview</div>';
    return;
  }

  const spec = MAT_SPECS[calc.matType];
  const physLen = calc.matType === 'wet_area_3' ? calc.roundedLength : calc.length;
  const physWid = calc.matType === 'wet_area_3' ? 3 : calc.width;

  const pad = 35;
  const scale = Math.min((380 - 2 * pad) / physWid, (260 - 2 * pad) / physLen, 35);
  scaleTag.textContent = `Scale: 1 ft = ${Math.round(scale)}px`;

  const svgW = physWid * scale + 2 * pad;
  const svgH = physLen * scale + 2 * pad;
  const w = physWid * scale;
  const h = physLen * scale;
  const edgingColor = '#00508C';

  let svg = `<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}">
    <defs>
      <pattern id="waste-stripe" width="8" height="8" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#fca5a5" stroke-width="1.5" />
      </pattern>
    </defs>
    <!-- Base Canvas -->
    <rect x="${pad}" y="${pad}" width="${w}" height="${h}" fill="#cbd5e1" stroke="#94a3b8" stroke-width="2" rx="3" />`;

  if (calc.matType === 'wet_area_3') {
    // Actual requested customer area
    svg += `<rect x="${pad}" y="${pad}" width="${calc.width * scale}" height="${calc.length * scale}" fill="#94a3b8" stroke="#64748b" stroke-width="1" />`;
    
    // Discarded charged cut strips
    if (calc.width < 3) {
      svg += `<rect x="${pad + calc.width * scale}" y="${pad}" width="${(3 - calc.width) * scale}" height="${physLen * scale}" fill="url(#waste-stripe)" opacity="0.6" />`;
    }
    if (calc.length < calc.roundedLength) {
      svg += `<rect x="${pad}" y="${pad + calc.length * scale}" width="${calc.width * scale}" height="${(calc.roundedLength - calc.length) * scale}" fill="url(#waste-stripe)" opacity="0.6" />`;
    }
  } else {
    // Longitudinal Seams
    for (let c = 1; c < calc.cols; c++) {
      const cx = pad + c * spec.standardWidth * scale;
      svg += `<line x1="${cx}" y1="${pad}" x2="${cx}" y2="${pad + h}" stroke="#ef4444" stroke-width="2" stroke-dasharray="4 4" />`;
    }
    // Transverse Seams
    for (let r = 1; r < calc.rows; r++) {
      const cy = pad + r * spec.standardLength * scale;
      svg += `<line x1="${pad}" y1="${cy}" x2="${pad + w}" y2="${cy}" stroke="#ef4444" stroke-width="2" stroke-dasharray="4 4" />`;
    }

    // Edging Border Visualization
    if (calc.edgingType !== 'none') {
      if (calc.edgingSides === 'four_sides' || calc.edgingSides === 'two_sides') {
        svg += `<rect x="${pad - 2}" y="${pad - 4}" width="${w + 4}" height="5" fill="${edgingColor}" />
                <rect x="${pad - 2}" y="${pad + h - 1}" width="${w + 4}" height="5" fill="${edgingColor}" />`;
      }
      if (calc.edgingSides === 'four_sides') {
        svg += `<rect x="${pad - 4}" y="${pad - 2}" width="5" height="${h + 4}" fill="${edgingColor}" />
                <rect x="${pad + w - 1}" y="${pad - 2}" width="5" height="${h + 4}" fill="${edgingColor}" />`;
      }
    }
  }

  // Dimension Callouts
  svg += `<line x1="${pad}" y1="${pad - 14}" x2="${pad + w}" y2="${pad - 14}" stroke="#64748b" stroke-width="1"/>
          <text x="${pad + w / 2}" y="${pad - 18}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700" fill="#334155">${calc.width} ft</text>
          <line x1="${pad - 14}" y1="${pad}" x2="${pad - 14}" y2="${pad + h}" stroke="#64748b" stroke-width="1"/>
          <text x="${pad - 18}" y="${pad + h / 2}" text-anchor="middle" transform="rotate(-90 ${pad - 18} ${pad + h / 2})" font-family="JetBrains Mono, monospace" font-size="10" font-weight="700" fill="#334155">${calc.length} ft</text>
          <text x="${pad + w / 2}" y="${pad + h / 2 + 4}" text-anchor="middle" font-family="Montserrat, sans-serif" font-size="9" font-weight="700" fill="#1e293b">${calc.matType === 'wet_area_3' ? `Charged 3.0 x ${calc.roundedLength}.0 ft` : `${calc.cols} x ${calc.rows} Panels`}</text>
  </svg>`;

  container.innerHTML = svg;

  // Legends
  document.getElementById('legend-seam-text').textContent = `Adhesive Seam (${calc.seamAdhesiveLength.toFixed(1)} ft)`;
  const edgeLeg = document.getElementById('legend-edging-item');
  if (calc.edgingType !== 'none' && calc.matType !== 'wet_area_3') {
    edgeLeg.classList.remove('hidden');
    document.getElementById('legend-edging-swatch').style.backgroundColor = edgingColor;
    document.getElementById('legend-edging-text').textContent = `${calc.edgingType.replace('_', ' ')} (${calc.edgingLength.toFixed(1)} ft)`;
  } else {
    edgeLeg.classList.add('hidden');
  }

  const wasteLeg = document.getElementById('legend-waste-item');
  const hasWaste = calc.matType === 'wet_area_3' && (calc.width < 3 || calc.length < calc.roundedLength);
  wasteLeg.classList.toggle('hidden', !hasWaste);
}

// 5. Render Mat Selection Buttons
function renderMatGrid() {
  const grid = document.getElementById('mat-type-grid');
  grid.innerHTML = '';

  Object.values(MAT_SPECS).forEach(spec => {
    const isSelected = state.matType === spec.id;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `mat-btn ${isSelected ? 'selected' : ''}`;
    btn.setAttribute('data-id', spec.id);

    // Hide internal base cost rate unless authenticated as administrator
    const costHtml = state.isAdmin ? `
      <div class="mat-btn-cost">
        <span class="text-xs text-muted">Base Cost / Sq. Ft:</span>
        <span class="mat-btn-rate">${formatPHP(spec.costPerSqFt)}</span>
      </div>` : '';

    btn.innerHTML = `
      <div class="mat-btn-head">
        <div>
          <span class="mat-btn-name">${spec.name}</span>
          <span class="mat-btn-dim">${spec.standardWidth} ft &times; ${spec.standardLength} ft Master Roll</span>
        </div>
        ${isSelected ? '<span class="check-badge">&check;</span>' : ''}
      </div>
      ${costHtml}
    `;

    btn.addEventListener('click', () => {
      state.matType = spec.id;
      if (spec.id === 'wet_area_3') {
        state.width = 3;
        state.length = 4;
        state.edgingSides = 'none';
        state.edgingType = 'none';
        state.useAdhesive = false;
      } else {
        if (state.width > 20) state.width = spec.standardWidth;
        if (state.length > 100) state.length = 12;
        if (state.edgingSides === 'none') {
          state.edgingSides = 'four_sides';
          state.edgingType = 'low_profile';
        }
        state.useAdhesive = true;
      }
      document.getElementById('width-number-input').value = state.width;
      document.getElementById('width-range-input').value = state.width;
      document.getElementById('length-number-input').value = state.length;
      document.getElementById('length-range-input').value = state.length;
      updateUI();
    });

    grid.appendChild(btn);
  });
}

// 6. UI Synchronization & Update
function updateUI() {
  const calc = calculateOrder(state);
  const spec = MAT_SPECS[state.matType];
  const isWet = state.matType === 'wet_area_3';

  // Toggle Mode (Materials Only vs Commercial Pricing)
  const appTitle = document.getElementById('app-title');
  const appSubtitle = document.getElementById('app-subtitle');
  const modeBtn = document.getElementById('toggle-costs-mode-btn');
  const modeLabel = document.getElementById('mode-toggle-label');

  // Administrator status button update
  const adminAuthBtn = document.getElementById('admin-auth-toggle-btn');
  const adminAuthLabel = document.getElementById('admin-auth-label');
  if (adminAuthBtn && adminAuthLabel) {
    if (state.isAdmin) {
      adminAuthBtn.className = 'btn btn-xs btn-admin-active';
      adminAuthLabel.textContent = 'Admin Unlocked (Lock)';
      adminAuthBtn.title = 'Administrator access active. Click to lock.';
    } else {
      adminAuthBtn.className = 'btn btn-xs btn-secondary';
      adminAuthLabel.textContent = 'Admin Login';
      adminAuthBtn.title = 'Administrator access for protected features';
    }
  }

  if (state.hideCosts) {
    appTitle.textContent = 'Custom Matting Material Estimator';
    appSubtitle.textContent = 'Precision industrial material usage, butt joint adhesive bonding, and edging bevel estimator';
    modeBtn.className = 'btn btn-mode-toggle';
    modeLabel.textContent = 'Materials Only Mode';
  } else {
    appTitle.textContent = 'Custom Matting & Pricing Calculator';
    appSubtitle.textContent = 'Precision industrial manufacturing and commercial estimating engine';
    modeBtn.className = 'btn btn-mode-toggle active-pricing';
    modeLabel.textContent = 'Commercial Pricing Mode';
  }

  // Refresh Mat Grid UI
  renderMatGrid();

  // Range and Input Caps
  const wNum = document.getElementById('width-number-input');
  const wRange = document.getElementById('width-range-input');
  const lNum = document.getElementById('length-number-input');
  const lRange = document.getElementById('length-range-input');

  wRange.max = isWet ? '3' : '20';
  lRange.max = isWet ? '10' : '100';
  document.getElementById('width-cap-notice').classList.toggle('hidden', !isWet);
  document.getElementById('width-max-label').textContent = isWet ? 'Max: 3.0 ft' : 'Max: 20.0 ft';
  document.getElementById('length-rounding-notice').classList.toggle('hidden', !isWet);
  document.getElementById('length-max-label').textContent = isWet ? 'Max: 10.0 ft' : 'Max: 100.0 ft';
  document.getElementById('wet-area-notice-box').classList.toggle('hidden', !isWet);

  // Sizing Error Notice
  const errBox = document.getElementById('sizing-error-box');
  if (!calc.isValid && calc.errorMessage) {
    errBox.classList.remove('hidden');
    document.getElementById('sizing-error-message').textContent = calc.errorMessage;
  } else {
    errBox.classList.add('hidden');
  }

  // Active Rule Card
  const ruleCard = document.getElementById('active-rule-card');
  if (ruleCard) {
    document.getElementById('active-rule-title').textContent = calc.activeRule;
    document.getElementById('active-rule-desc').textContent = calc.ruleDescription;
  }

  // Accessory Buttons
  document.querySelectorAll('[data-adhesive]').forEach(btn => {
    btn.classList.toggle('active', (btn.dataset.adhesive === 'true') === state.useAdhesive);
    btn.disabled = isWet;
  });

  document.querySelectorAll('[data-sides]').forEach(btn => {
    const disabled = isWet || (state.edgingType === 'none' && btn.dataset.sides !== 'none');
    btn.disabled = disabled;
    btn.classList.toggle('active', state.edgingSides === btn.dataset.sides && state.edgingType !== 'none' && !isWet);
  });

  document.querySelectorAll('[data-type]').forEach(btn => {
    btn.disabled = isWet;
    btn.classList.toggle('active', state.edgingType === btn.dataset.type && !isWet);
  });

  // Regional Pricing Buttons & Dropdown
  document.querySelectorAll('[data-region]').forEach(btn => {
    btn.classList.toggle('active', state.region === btn.dataset.region);
  });
  document.getElementById('bracket-select').value = state.bracket;

  // Internal mathematical formula & cost basis percentage are hidden from public view
  const costFactorBox = document.getElementById('cost-factor-box');
  if (costFactorBox) {
    costFactorBox.classList.toggle('hidden', !state.isAdmin);
    document.getElementById('cost-factor-display').textContent = `Cost Basis: ${(calc.costPercentage * 100).toFixed(0)}%`;
  }

  // Render SVG Blueprint
  renderBlueprint(calc);

  // Summary Card Header and View Toggles
  const summaryKicker = document.getElementById('summary-kicker');
  const summaryTitle = document.getElementById('summary-title');
  const summaryBadge = document.getElementById('summary-badge');
  const matMetricsView = document.getElementById('material-metrics-view');
  const costBreakdownView = document.getElementById('cost-breakdown-view');
  const lockedNotice = document.getElementById('cost-breakdown-locked-notice');

  const qtyLabel = calc.quantity === 1 ? '1 unit' : `${calc.quantity} units`;

  if (!state.isAdmin) {
    // Customer/Public view: Specifications and commercial proposal visible; itemized direct costs locked
    summaryKicker.textContent = 'Commercial Proposal';
    summaryTitle.textContent = 'Specifications & Proposal';
    summaryBadge.textContent = 'Commercial Offer';
    matMetricsView.classList.remove('hidden');
    costBreakdownView.classList.add('hidden');
    if (lockedNotice) lockedNotice.classList.remove('hidden');
  } else {
    // Authenticated Administrator view: Full visibility into direct cost breakdown or materials mode
    summaryKicker.textContent = state.hideCosts ? 'Production Requisition' : 'Commercial Proposal';
    summaryTitle.textContent = state.hideCosts ? 'Material Requirements' : 'Itemized Cost Breakdown';
    summaryBadge.textContent = state.hideCosts ? `${spec.standardWidth} ft stock roll` : `${state.region} / ${state.bracket}`;
    matMetricsView.classList.toggle('hidden', !state.hideCosts);
    costBreakdownView.classList.toggle('hidden', state.hideCosts);
    if (lockedNotice) lockedNotice.classList.add('hidden');
  }

  // Update Material Metrics View (Public & Materials Mode)
  document.getElementById('mat-usage-dimensions').textContent = isWet
    ? `3.0 ft x ${calc.roundedLength}.0 ft`
    : `${calc.width.toFixed(1)} ft x ${calc.length.toFixed(1)} ft`;
  document.getElementById('mat-usage-subtext').textContent = isWet
    ? `Rounded to allowable standard stock cut (3x${calc.roundedLength}) | Qty: ${qtyLabel} (${calc.orderSquareFeet.toFixed(1)} sq. ft. total)`
    : `${calc.cols} x ${calc.rows} panels per unit | Qty: ${qtyLabel} (${calc.orderSquareFeet.toFixed(1)} sq. ft. total)`;
  document.getElementById('adhesive-usage-length').textContent = `${calc.orderAdhesiveLength.toFixed(1)} ln. ft.`;
  document.getElementById('adhesive-usage-subtext').textContent = `Per unit: ${calc.adhesiveLengthWithWaste.toFixed(1)} ft (seams: ${calc.seamAdhesiveLength.toFixed(1)} ft + edging: ${calc.edgingAdhesiveLength.toFixed(1)} ft)`;
  document.getElementById('edging-usage-length').textContent = calc.edgingType === 'none' || isWet ? 'No Edging Applied' : `${calc.orderEdgingLength.toFixed(1)} ln. ft.`;
  document.getElementById('edging-usage-subtext').textContent = calc.edgingType === 'none' || isWet
    ? 'No border reducer specified'
    : `${calc.edgingType.replace('_', ' ')} on ${calc.edgingSides.replace('_', ' ')} | ${calc.edgingLength.toFixed(1)} ft/unit x ${qtyLabel}`;

  // Update Itemized Cost Breakdown View (Internal Admin)
  document.getElementById('cost-val-matting').textContent = formatPHP(calc.mattingCost);
  document.getElementById('cost-label-adhesive').textContent = `2. Seam Adhesive (${(calc.seamAdhesiveLength * ADHESIVE_WASTE_FACTOR * calc.quantity).toFixed(1)} ft):`;
  document.getElementById('cost-val-adhesive').textContent = formatPHP(calc.seamAdhesiveCost);
  document.getElementById('cost-val-edging').textContent = formatPHP(calc.edgingCost);
  document.getElementById('cost-val-edging-adhesive').textContent = formatPHP(calc.edgingAdhesiveCost);
  document.getElementById('cost-label-labor').textContent = `5. Fixed Labor Cost (${qtyLabel}):`;
  document.getElementById('cost-val-labor').textContent = formatPHP(calc.laborCost);
  document.getElementById('cost-val-total').textContent = formatPHP(calc.totalCost);

  // Pricing Summary
  document.getElementById('price-quantity-display').textContent = qtyLabel;
  document.getElementById('price-unit-excl-vat').textContent = formatPHP(calc.unitSellingPriceExclVat);
  document.getElementById('price-excl-vat').textContent = formatPHP(calc.sellingPriceExclVat);
  document.getElementById('price-vat').textContent = formatPHP(calc.vatAmount);
  document.getElementById('price-inc-vat').textContent = calc.isValid ? formatPHP(calc.finalSellingPrice) : '₱0.00';

  document.getElementById('btn-open-quote-modal').disabled = !calc.isValid;
  document.getElementById('btn-open-jo-modal').disabled = !calc.isValid;
}

// 7. Document Logging System (LocalStorage synced)
function getDocLog() {
  try {
    const saved = localStorage.getItem('matting_doc_log');
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveDocLog(entry) {
  try {
    const list = [entry, ...getDocLog()].slice(0, 200);
    localStorage.setItem('matting_doc_log', JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function clearDocLog() {
  if (window.confirm('Clear all stored quote and job order history on this device?')) {
    localStorage.removeItem('matting_doc_log');
    renderDocLogModal();
  }
}

function renderDocLogModal() {
  const container = document.getElementById('doc-log-items-container');
  const emptyBox = document.getElementById('doc-log-empty');
  const list = getDocLog();

  if (list.length === 0) {
    emptyBox.classList.remove('hidden');
    container.innerHTML = '';
    return;
  }

  emptyBox.classList.add('hidden');
  container.innerHTML = list.map(item => `
    <div class="doc-log-row">
      <div class="doc-log-main">
        <span class="doc-log-badge ${item.docType === 'quote' ? 'badge-quote' : 'badge-jo'}">
          ${item.docType === 'quote' ? 'Quotation' : 'Job Order'}
        </span>
        <span class="doc-log-number">${item.docNumber}</span>
      </div>
      <div class="doc-log-meta">
        <span><strong>${item.matName}</strong> (${item.width}ft &times; ${item.length}ft) &bull; Qty: ${item.quantity}</span>
        <span>${item.date} ${item.preparedBy ? `&bull; Prepared by: ${item.preparedBy}` : ''}</span>
      </div>
      <div class="doc-log-price">${formatPHP(item.totalAmount)}</div>
    </div>
  `).join('');
}

// 8. Print Modal Handling (Quote & Job Order)
function openPrintModal(type) {
  state.activeDocType = type;
  const calc = calculateOrder(state);
  const spec = MAT_SPECS[calc.matType];
  const dateStr = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const docNum = `${type === 'quote' ? 'QT' : 'JO'}-${Date.now().toString().slice(-6)}`;

  state.lockedDocNumber = docNum;

  document.getElementById('modal-doc-title').textContent = type === 'quote' ? 'Commercial Quotation' : 'Production Job Order';
  document.getElementById('doc-header-h1').textContent = type === 'quote' ? 'COMMERCIAL QUOTATION' : 'PRODUCTION JOB ORDER';
  document.getElementById('doc-header-kicker').textContent = type === 'quote' ? 'Official Commercial Proposal' : 'Manufacturing Work Order';
  document.getElementById('doc-header-num').textContent = docNum;
  document.getElementById('doc-header-date').textContent = dateStr;

  // Populate Details
  document.getElementById('doc-field-mat-name').textContent = spec.name;
  document.getElementById('doc-field-dimensions').textContent = calc.matType === 'wet_area_3'
    ? `${calc.width.toFixed(1)} ft x ${calc.length.toFixed(1)} ft (Charged: 3.0 ft x ${calc.roundedLength}.0 ft)`
    : `${calc.width.toFixed(1)} ft x ${calc.length.toFixed(1)} ft (${calc.cols} x ${calc.rows} Panels)`;
  document.getElementById('doc-field-quantity').textContent = `${calc.quantity} ${calc.quantity === 1 ? 'unit' : 'units'}`;
  document.getElementById('doc-field-assembly-rule').textContent = calc.activeRule;

  // Edging & Adhesive Spec (Cleaned of internal waste formula markers)
  document.getElementById('doc-field-adhesive').textContent = calc.matType === 'wet_area_3'
    ? 'None (Rule 7 Special Exception)'
    : state.useAdhesive ? `Butt joint adhesive: ${calc.adhesiveLengthWithWaste.toFixed(1)} linear ft / unit` : 'None';
  document.getElementById('doc-field-edging').textContent = calc.matType === 'wet_area_3'
    ? 'None (Rule 7 Special Exception)'
    : calc.edgingType !== 'none' ? `${calc.edgingType.replace('_', ' ')} along ${calc.edgingSides.replace('_', ' ')} (${calc.edgingLength.toFixed(1)} ft / unit)` : 'None';

  // Financial Lines (Quotes show financial values; Job Orders show specs and signoffs)
  const isQuote = type === 'quote';
  document.getElementById('doc-financial-section').classList.toggle('hidden', !isQuote);
  document.getElementById('doc-signs-quote').classList.toggle('hidden', !isQuote);
  document.getElementById('doc-signs-jo').classList.toggle('hidden', isQuote);

  if (isQuote) {
    const pricingTierEl = document.getElementById('doc-field-pricing-tier');
    if (pricingTierEl) pricingTierEl.closest('.doc-tr')?.remove();
    document.getElementById('doc-field-unit-excl-vat').textContent = formatPHP(calc.unitSellingPriceExclVat);
    document.getElementById('doc-field-total-excl-vat').textContent = formatPHP(calc.sellingPriceExclVat);
    document.getElementById('doc-field-vat').textContent = formatPHP(calc.vatAmount);
    document.getElementById('doc-field-final-price').textContent = formatPHP(calc.finalSellingPrice);
  }

  // Show Modal
  document.getElementById('print-modal').classList.remove('hidden');
}

function executePrintAndLog() {
  const calc = calculateOrder(state);
  const spec = MAT_SPECS[calc.matType];
  const prepName = document.getElementById('prepared-by-input').value.trim();

  // Save to Log
  saveDocLog({
    id: Date.now().toString(),
    docType: state.activeDocType,
    docNumber: state.lockedDocNumber,
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    matName: spec.name,
    width: calc.width,
    length: calc.length,
    quantity: calc.quantity,
    totalAmount: calc.finalSellingPrice,
    preparedBy: prepName || 'Commercial Estimator'
  });

  window.print();
}

// 9. Event Listeners & Bootstrapping
document.addEventListener('DOMContentLoaded', () => {
  // Dimension Inputs
  const wNum = document.getElementById('width-number-input');
  const wRange = document.getElementById('width-range-input');
  const lNum = document.getElementById('length-number-input');
  const lRange = document.getElementById('length-range-input');

  wNum.addEventListener('input', e => {
    state.width = parseFloat(e.target.value) || 0;
    wRange.value = state.width;
    updateUI();
  });
  wRange.addEventListener('input', e => {
    state.width = parseFloat(e.target.value) || 0;
    wNum.value = state.width;
    updateUI();
  });
  lNum.addEventListener('input', e => {
    state.length = parseFloat(e.target.value) || 0;
    lRange.value = state.length;
    updateUI();
  });
  lRange.addEventListener('input', e => {
    state.length = parseFloat(e.target.value) || 0;
    lNum.value = state.length;
    updateUI();
  });

  // Quantity Stepper
  const qtyNum = document.getElementById('quantity-number-input');
  const qtyDec = document.getElementById('quantity-decrement-btn');
  const qtyInc = document.getElementById('quantity-increment-btn');

  function setQuantity(val) {
    const clamped = Math.min(MAX_QUANTITY, Math.max(MIN_QUANTITY, Math.round(val) || MIN_QUANTITY));
    state.quantity = clamped;
    qtyNum.value = clamped;
    updateUI();
  }

  qtyNum.addEventListener('input', e => setQuantity(parseFloat(e.target.value)));
  qtyDec.addEventListener('click', () => setQuantity(state.quantity - 1));
  qtyInc.addEventListener('click', () => setQuantity(state.quantity + 1));

  // Adhesive Buttons
  document.querySelectorAll('[data-adhesive]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.useAdhesive = btn.dataset.adhesive === 'true';
      updateUI();
    });
  });

  // Edging Sides Buttons
  document.querySelectorAll('[data-sides]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.edgingSides = btn.dataset.sides;
      if (btn.dataset.sides === 'none') state.edgingType = 'none';
      else if (state.edgingType === 'none') state.edgingType = 'low_profile';
      updateUI();
    });
  });

  // Edging Profile Buttons
  document.querySelectorAll('[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.edgingType = btn.dataset.type;
      if (btn.dataset.type === 'none') state.edgingSides = 'none';
      else if (state.edgingSides === 'none') state.edgingSides = 'four_sides';
      updateUI();
    });
  });

  // Region Buttons
  document.querySelectorAll('[data-region]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.region = btn.dataset.region;
      updateUI();
    });
  });

  // Bracket Dropdown
  document.getElementById('bracket-select').addEventListener('change', e => {
    state.bracket = e.target.value;
    updateUI();
  });

  // Modal Open Triggers (Protected by Admin Password)
  document.getElementById('btn-open-quote-modal').addEventListener('click', () => openPrintModal('quote'));
  document.getElementById('btn-open-jo-modal').addEventListener('click', () => openPrintModal('job_order'));

  // 1. Mode Switching Toggle (Password Protected)
  document.getElementById('toggle-costs-mode-btn').addEventListener('click', () => {
    requestAdminAccess(() => {
      state.hideCosts = !state.hideCosts;
      updateUI();
    }, 'Enter administrator password to switch calculation and display modes.');
  });

  // 2. Customization Rules modal / view (Password Protected)
  document.getElementById('btn-open-rules').addEventListener('click', () => {
    requestAdminAccess(() => {
      document.getElementById('rules-modal').classList.remove('hidden');
    }, 'Enter administrator password to view Customization Rules & Assembly Guide.');
  });

  const footerRulesBtn = document.getElementById('footer-rules-btn');
  if (footerRulesBtn) {
    footerRulesBtn.addEventListener('click', () => {
      requestAdminAccess(() => {
        document.getElementById('rules-modal').classList.remove('hidden');
      }, 'Enter administrator password to view Customization Rules & Assembly Guide.');
    });
  }

  // 3. Calculation History Log (Password Protected)
  document.getElementById('btn-open-doc-log').addEventListener('click', () => {
    requestAdminAccess(() => {
      renderDocLogModal();
      document.getElementById('doc-log-modal').classList.remove('hidden');
    }, 'Enter administrator password to access Quotation & Order History Log.');
  });

  // 4. Itemized Cost Breakdown modal / view (Password Protected)
  document.getElementById('btn-open-cost-breakdown').addEventListener('click', () => {
    requestAdminAccess(() => {
      openCostBreakdownModal();
    }, 'Enter administrator password to inspect internal manufacturing cost breakdown.');
  });

  const lockedNoticeBtn = document.getElementById('cost-breakdown-locked-notice');
  if (lockedNoticeBtn) {
    lockedNoticeBtn.addEventListener('click', () => {
      requestAdminAccess(() => {
        openCostBreakdownModal();
      }, 'Enter administrator password to inspect internal manufacturing cost breakdown.');
    });
  }

  // Admin Login / Lock toggle in header
  const adminAuthToggleBtn = document.getElementById('admin-auth-toggle-btn');
  if (adminAuthToggleBtn) {
    adminAuthToggleBtn.addEventListener('click', () => {
      if (state.isAdmin) {
        state.isAdmin = false;
        updateUI();
      } else {
        requestAdminAccess(() => {
          // Successfully logged in
        }, 'Enter master administrator password ("grb123") to unlock privileged features.');
      }
    });
  }

  // Admin Password Prompt Modal Handlers
  document.getElementById('admin-password-form').addEventListener('submit', e => {
    e.preventDefault();
    verifyAdminPassword();
  });
  document.getElementById('btn-submit-password').addEventListener('click', verifyAdminPassword);
  document.getElementById('btn-cancel-password').addEventListener('click', closePasswordModal);
  document.getElementById('btn-close-password-modal').addEventListener('click', closePasswordModal);

  // Itemized Cost Breakdown Modal Handlers
  document.getElementById('btn-close-cost-breakdown-modal').addEventListener('click', () => {
    document.getElementById('cost-breakdown-modal').classList.add('hidden');
  });
  document.getElementById('btn-close-cost-breakdown-footer').addEventListener('click', () => {
    document.getElementById('cost-breakdown-modal').classList.add('hidden');
  });

  // Modal Close Triggers
  document.getElementById('btn-close-print-modal').addEventListener('click', () => {
    document.getElementById('print-modal').classList.add('hidden');
  });
  document.getElementById('btn-close-doc-log').addEventListener('click', () => {
    document.getElementById('doc-log-modal').classList.add('hidden');
  });
  document.getElementById('btn-close-rules-modal').addEventListener('click', () => {
    document.getElementById('rules-modal').classList.add('hidden');
  });
  document.getElementById('btn-rules-footer-close').addEventListener('click', () => {
    document.getElementById('rules-modal').classList.add('hidden');
  });

  // Print Document Trigger
  document.getElementById('btn-trigger-print').addEventListener('click', executePrintAndLog);

  // Clear Document Log Trigger
  document.getElementById('btn-clear-doc-log').addEventListener('click', clearDocLog);

  // Initial UI Render
  updateUI();
});

// Helper Functions for Administrator Authentication & Cost Breakdown
function requestAdminAccess(onSuccess, promptMsg) {
  if (state.isAdmin) {
    if (typeof onSuccess === 'function') onSuccess();
    return;
  }
  pendingAdminAction = onSuccess;
  const modal = document.getElementById('password-prompt-modal');
  const input = document.getElementById('admin-password-input');
  const err = document.getElementById('admin-password-error');
  const desc = document.getElementById('password-prompt-description');
  
  if (promptMsg && desc) {
    desc.textContent = promptMsg;
  } else if (desc) {
    desc.textContent = 'This feature is restricted to authorized personnel. Enter the administrative password to proceed.';
  }
  
  input.value = '';
  input.classList.remove('input-error');
  err.classList.add('hidden');
  modal.classList.remove('hidden');
  setTimeout(() => input.focus(), 60);
}

function verifyAdminPassword() {
  const input = document.getElementById('admin-password-input');
  const err = document.getElementById('admin-password-error');
  const val = (input.value || '').trim();

  if (val === ADMIN_PASSWORD) {
    state.isAdmin = true;
    document.getElementById('password-prompt-modal').classList.add('hidden');
    updateUI();
    if (typeof pendingAdminAction === 'function') {
      const action = pendingAdminAction;
      pendingAdminAction = null;
      action();
    }
  } else {
    err.classList.remove('hidden');
    input.classList.add('input-error');
    input.classList.add('shake');
    setTimeout(() => input.classList.remove('shake'), 400);
    input.focus();
  }
}

function closePasswordModal() {
  document.getElementById('password-prompt-modal').classList.add('hidden');
  pendingAdminAction = null;
}

function openCostBreakdownModal() {
  const calc = calculateOrder(state);
  const qtyLabel = calc.quantity === 1 ? '1 unit' : `${calc.quantity} units`;

  document.getElementById('modal-cost-matting').textContent = formatPHP(calc.mattingCost);
  document.getElementById('modal-cost-label-seam-adhesive').textContent = `2. Seam Adhesive (${(calc.seamAdhesiveLength * ADHESIVE_WASTE_FACTOR * calc.quantity).toFixed(1)} ft):`;
  document.getElementById('modal-cost-seam-adhesive').textContent = formatPHP(calc.seamAdhesiveCost);
  document.getElementById('modal-cost-edging').textContent = formatPHP(calc.edgingCost);
  document.getElementById('modal-cost-label-edging-adhesive').textContent = `4. Edging Adhesive (${(calc.edgingAdhesiveLength * ADHESIVE_WASTE_FACTOR * calc.quantity).toFixed(1)} ft):`;
  document.getElementById('modal-cost-edging-adhesive').textContent = formatPHP(calc.edgingAdhesiveCost);
  document.getElementById('modal-cost-label-labor').textContent = `5. Fixed Labor Cost (${qtyLabel}):`;
  document.getElementById('modal-cost-labor').textContent = formatPHP(calc.laborCost);
  document.getElementById('modal-cost-total').textContent = formatPHP(calc.totalCost);

  document.getElementById('modal-cost-bracket').textContent = `${state.region} Region - ${BRACKET_LABELS[state.bracket]}`;
  document.getElementById('modal-cost-basis').textContent = `${(calc.costPercentage * 100).toFixed(0)}% (Direct Cost Basis)`;
  document.getElementById('modal-cost-excl-vat').textContent = formatPHP(calc.sellingPriceExclVat);
  document.getElementById('modal-cost-vat').textContent = formatPHP(calc.vatAmount);
  document.getElementById('modal-cost-inc-vat').textContent = formatPHP(calc.finalSellingPrice);

  document.getElementById('cost-breakdown-modal').classList.remove('hidden');
}
