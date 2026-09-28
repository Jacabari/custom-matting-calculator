/**
 * Commercial Matting Estimator & Pricing Calculator
 * Pure Vanilla JavaScript (ES6) Engine - Isolated Client-Side Execution
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

// Commercial Functional Edging Presets
const EDGING_PRESETS = {
  none: {
    id: 'none',
    name: 'No Edging',
    label: 'No Edging',
    short: 'No Edging',
    blueprintLabel: 'None',
    calcLength: () => 0
  },
  two_width: {
    id: 'two_width',
    name: '2 Width Sides (Traffic Entrance & Exit Ends)',
    label: '2 Width Sides',
    short: '2 Width Sides',
    blueprintLabel: 'Traffic Entrance & Exit Ends',
    calcLength: (w, l) => 2 * w
  },
  two_length: {
    id: 'two_length',
    name: '2 Length Sides (Corridor/Walkway Borders)',
    label: '2 Length Sides',
    short: '2 Length Sides',
    blueprintLabel: 'Corridor/Walkway Borders',
    calcLength: (w, l) => 2 * l
  },
  four_sides: {
    id: 'four_sides',
    name: 'All 4 Sides (Full Perimeter)',
    label: 'All 4 Sides',
    short: 'All 4 Sides',
    blueprintLabel: 'Full Perimeter',
    calcLength: (w, l) => (2 * w) + (2 * l)
  }
};

// In-Memory Application State (Isolated Per Client Session)
const DEFAULT_STATE = {
  matType: 'heavy_8250',
  width: 5,
  length: 12,
  useAdhesive: true,
  edgingProfile: 'low_profile', // 'none' | 'low_profile' | 'high_profile'
  edgingSides: 'four_sides',    // 'none' | 'two_width' | 'two_length' | 'four_sides'
  region: 'Luzon',              // 'Luzon' | 'VisMin'
  bracket: 'SRP',               // 'SRP' | 'B1' | 'B2' | 'B3' | 'B4'
  isAdmin: false
};

const state = { ...DEFAULT_STATE };

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

// 3. Calculation Core Engine (Unit-Based - 1 Unit)
function calculateOrder(input) {
  const { matType, width, length, edgingProfile, edgingSides, region, bracket, useAdhesive } = input;
  const spec = MAT_SPECS[matType];

  const res = {
    matType, width, length, edgingProfile, edgingSides, region, bracket, useAdhesive,
    cols: 1, rows: 1, roundedLength: 0, activeRule: '', ruleDescription: '',
    seamAdhesiveLength: 0, edgingLength: 0, edgingAdhesiveLength: 0,
    totalAdhesiveLength: 0, adhesiveLengthWithWaste: 0,
    
    mattingCost: 0, seamAdhesiveCost: 0, edgingCost: 0, edgingAdhesiveCost: 0, adhesiveCost: 0,
    laborCost: FIXED_LABOR_COST,
    totalCost: 0,
    costPercentage: COST_PERCENTAGES[region]?.[bracket] || 0.73,
    sellingPriceExclVat: 0, vatAmount: 0, finalSellingPrice: 0,
    orderSquareFeet: width * length,
    isValid: true, errorMessage: ''
  };

  if (!spec) {
    res.isValid = false; res.errorMessage = 'Invalid mat type selected.'; return res;
  }
  if (width <= 0 || length <= 0 || isNaN(width) || isNaN(length)) {
    res.isValid = false; res.errorMessage = 'Width and length must be numbers greater than zero.'; return res;
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
    res.mattingCost = (3 * res.roundedLength) * spec.costPerSqFt;
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
    if (edgingProfile === 'none' || edgingSides === 'none') {
      res.edgingLength = 0;
    } else if (edgingSides === 'four_sides') {
      res.edgingLength = (2 * width) + (2 * length);
    } else if (edgingSides === 'two_width' || edgingSides === 'two_width_sides' || edgingSides === 'two_sides') {
      res.edgingLength = 2 * width;
    } else if (edgingSides === 'two_length' || edgingSides === 'two_length_sides') {
      res.edgingLength = 2 * length;
    } else {
      res.edgingLength = 0;
    }
    res.edgingAdhesiveLength = (useAdhesive && edgingProfile !== 'none') ? res.edgingLength : 0;

    // Rule categorization
    if (isWidthExceeded && isLengthExceeded) {
      if (edgingSides === 'four_sides' && edgingProfile !== 'none') {
        res.activeRule = 'Rule 5: Oversized Width & Length (All 4 Sides Edging \u2013 Full Perimeter)';
        res.ruleDescription = `Area exceeds roll width (${spec.standardWidth} ft) & length (${spec.standardLength} ft). Longitudinal & transverse seams bonded. Reducer bevel applied along all 4 outer edges (${((2 * width) + (2 * length)).toFixed(1)} ft).`;
      } else if ((edgingSides === 'two_width' || edgingSides === 'two_width_sides' || edgingSides === 'two_sides') && edgingProfile !== 'none') {
        res.activeRule = 'Rule 6: Oversized Width & Length (2 Width Sides Edging \u2013 Traffic Entrance & Exit Ends)';
        res.ruleDescription = `Area exceeds roll width & length. Multiple panels bonded along seams. Edging applied strictly along both width entrance/exit ends (${(2 * width).toFixed(1)} ft).`;
      } else if ((edgingSides === 'two_length' || edgingSides === 'two_length_sides') && edgingProfile !== 'none') {
        res.activeRule = 'Rule 6 (Variant): Oversized Width & Length (2 Length Sides Edging \u2013 Corridor/Walkway Borders)';
        res.ruleDescription = `Area exceeds roll width & length. Multiple panels bonded along seams. Edging applied strictly along both length walkway borders (${(2 * length).toFixed(1)} ft).`;
      } else {
        res.activeRule = 'Rule 4: Oversized Width & Length (No Edging)';
        res.ruleDescription = `Area exceeds roll width & length. Multiple panels bonded along length and width seams. No perimeter edging bevel applied.`;
      }
    } else if (isWidthExceeded) {
      if (edgingSides === 'four_sides' && edgingProfile !== 'none') {
        res.activeRule = 'Rule 2: Custom Width Exceeds Standard Size (All 4 Sides Edging \u2013 Full Perimeter)';
        res.ruleDescription = `Width (${width.toFixed(1)} ft) exceeds roll width (${spec.standardWidth} ft). Seam adhesive applied along ${length.toFixed(1)} ft join. Perimeter edging applied on all 4 outer sides (${((2 * width) + (2 * length)).toFixed(1)} ft).`;
      } else if ((edgingSides === 'two_width' || edgingSides === 'two_width_sides' || edgingSides === 'two_sides') && edgingProfile !== 'none') {
        res.activeRule = 'Rule 3: Custom Width Exceeds Standard Size (2 Width Sides Edging \u2013 Traffic Entrance & Exit Ends)';
        res.ruleDescription = `Width exceeds roll width. Panels bonded along seam. Edging applied along the 2 width entrance/exit ends only (${(2 * width).toFixed(1)} ft).`;
      } else if ((edgingSides === 'two_length' || edgingSides === 'two_length_sides') && edgingProfile !== 'none') {
        res.activeRule = 'Rule 3 (Variant): Custom Width Exceeds Standard Size (2 Length Sides Edging \u2013 Corridor/Walkway Borders)';
        res.ruleDescription = `Width exceeds roll width. Panels bonded along seam. Edging applied along the 2 length walkway borders only (${(2 * length).toFixed(1)} ft).`;
      } else {
        res.activeRule = 'Rule 1: Custom Width Exceeds Standard Size (No Edging)';
        res.ruleDescription = `Width exceeds roll width. Panels bonded with seam adhesive along joining length. No perimeter edging bevel applied.`;
      }
    } else {
      if (edgingSides === 'four_sides' && edgingProfile !== 'none') {
        res.activeRule = 'Standard Roll Cut (All 4 Sides Edging \u2013 Full Perimeter)';
        res.ruleDescription = `Dimensions fit within standard master roll width (${spec.standardWidth} ft). Seamless single panel with full perimeter reducer bevel (${((2 * width) + (2 * length)).toFixed(1)} ft).`;
      } else if ((edgingSides === 'two_width' || edgingSides === 'two_width_sides' || edgingSides === 'two_sides') && edgingProfile !== 'none') {
        res.activeRule = 'Standard Roll Cut (2 Width Sides Edging \u2013 Traffic Entrance & Exit Ends)';
        res.ruleDescription = `Dimensions fit within standard master roll width (${spec.standardWidth} ft). Seamless single panel with reducer on width entrance/exit ends (${(2 * width).toFixed(1)} ft).`;
      } else if ((edgingSides === 'two_length' || edgingSides === 'two_length_sides') && edgingProfile !== 'none') {
        res.activeRule = 'Standard Roll Cut (2 Length Sides Edging \u2013 Corridor/Walkway Borders)';
        res.ruleDescription = `Dimensions fit within standard master roll width (${spec.standardWidth} ft). Seamless single panel with reducer along length walkway borders (${(2 * length).toFixed(1)} ft).`;
      } else {
        res.activeRule = 'Standard Roll Cut (No Edging)';
        res.ruleDescription = `Dimensions fit within standard master roll width (${spec.standardWidth} ft). Single seamless continuous panel without edging.`;
      }
    }

    res.mattingCost = width * length * spec.costPerSqFt;
  }

  // Adhesive calculations with +5% waste factor
  res.totalAdhesiveLength = res.seamAdhesiveLength + res.edgingAdhesiveLength;
  res.adhesiveLengthWithWaste = res.totalAdhesiveLength * ADHESIVE_WASTE_FACTOR;

  // Single unit accessory costs
  const edgingRate = edgingProfile === 'low_profile' ? EDGING_LOW_PROFILE_COST : edgingProfile === 'high_profile' ? EDGING_HIGH_PROFILE_COST : 0;
  res.edgingCost = res.edgingLength * edgingRate;
  res.seamAdhesiveCost = res.seamAdhesiveLength * ADHESIVE_WASTE_FACTOR * ADHESIVE_COST_PER_LN_FT;
  res.edgingAdhesiveCost = res.edgingAdhesiveLength * ADHESIVE_WASTE_FACTOR * ADHESIVE_COST_PER_LN_FT;
  res.adhesiveCost = res.seamAdhesiveCost + res.edgingAdhesiveCost;
  res.laborCost = FIXED_LABOR_COST; // Fixed ₱100.00 per job order

  // Direct Total Cost
  res.totalCost = res.mattingCost + res.seamAdhesiveCost + res.edgingCost + res.edgingAdhesiveCost + res.laborCost;

  // Commercial Pricing: Selling Price = (Final Total Cost / Cost Percentage) * 1.12
  if (res.costPercentage > 0) {
    res.sellingPriceExclVat = res.totalCost / res.costPercentage;
    res.vatAmount = res.sellingPriceExclVat * VAT_RATE;
    res.finalSellingPrice = res.sellingPriceExclVat * (1 + VAT_RATE);
  }

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
  const scale = Math.min((480 - 2 * pad) / physWid, (280 - 2 * pad) / physLen, 35);
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

    // Edging Border Visualization matching Commercial Functional Presets
    if (calc.edgingProfile !== 'none' && calc.edgingSides !== 'none') {
      if (calc.edgingSides === 'four_sides') {
        // All 4 Sides (Full Perimeter): Top, Bottom, Left, and Right outer edges
        svg += `<rect x="${pad - 3}" y="${pad - 4}" width="${w + 6}" height="5" fill="${edgingColor}" rx="1" />
                <rect x="${pad - 3}" y="${pad + h - 1}" width="${w + 6}" height="5" fill="${edgingColor}" rx="1" />
                <rect x="${pad - 4}" y="${pad - 3}" width="5" height="${h + 6}" fill="${edgingColor}" rx="1" />
                <rect x="${pad + w - 1}" y="${pad - 3}" width="5" height="${h + 6}" fill="${edgingColor}" rx="1" />`;
      } else if (calc.edgingSides === 'two_width' || calc.edgingSides === 'two_width_sides' || calc.edgingSides === 'two_sides') {
        // 2 Width Sides (Traffic Entrance & Exit Ends): Top and Bottom outer edges
        svg += `<rect x="${pad}" y="${pad - 4}" width="${w}" height="5" fill="${edgingColor}" rx="1" />
                <rect x="${pad}" y="${pad + h - 1}" width="${w}" height="5" fill="${edgingColor}" rx="1" />`;
      } else if (calc.edgingSides === 'two_length' || calc.edgingSides === 'two_length_sides') {
        // 2 Length Sides (Corridor/Walkway Borders): Left and Right outer edges
        svg += `<rect x="${pad - 4}" y="${pad}" width="5" height="${h}" fill="${edgingColor}" rx="1" />
                <rect x="${pad + w - 1}" y="${pad}" width="5" height="${h}" fill="${edgingColor}" rx="1" />`;
      }
      // No Edging ('none'): Omit edging border graphics entirely
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
  if (calc.edgingProfile !== 'none' && calc.edgingSides !== 'none' && calc.matType !== 'wet_area_3') {
    edgeLeg.classList.remove('hidden');
    document.getElementById('legend-edging-swatch').style.backgroundColor = edgingColor;
    const profileLabel = calc.edgingProfile === 'low_profile' ? 'Low Profile' : 'High Profile';
    const presetObj = EDGING_PRESETS[calc.edgingSides] || (calc.edgingSides === 'two_sides' ? EDGING_PRESETS.two_width : EDGING_PRESETS.four_sides);
    document.getElementById('legend-edging-text').textContent = `${profileLabel} \u2013 ${presetObj.label || presetObj.short} (${calc.edgingLength.toFixed(1)} ft)`;
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
        state.edgingProfile = 'none';
        state.useAdhesive = false;
      } else {
        if (state.width > 20) state.width = spec.standardWidth;
        if (state.length > 100) state.length = 12;
        if (state.edgingSides === 'none') {
          state.edgingSides = 'four_sides';
          state.edgingProfile = 'low_profile';
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

// 6. Granular Manufacturing Formulas & Cost Breakdown Details (Admin Only)
function getDetailedCostStrings(calc, spec) {
  const isWet = calc.matType === 'wet_area_3';

  // 1. Matting Material Formula
  const mattingSub = isWet
    ? `Rule 7: Charged 3.0 ft \u00D7 ${calc.roundedLength}.0 ft (${(3 * calc.roundedLength).toFixed(1)} sq. ft.) @ ${formatPHP(spec.costPerSqFt)} / sq. ft.`
    : `${calc.width.toFixed(1)} ft \u00D7 ${calc.length.toFixed(1)} ft (${(calc.width * calc.length).toFixed(1)} sq. ft.) @ ${formatPHP(spec.costPerSqFt)} / sq. ft.`;

  // 2. Seam Adhesive Formula
  let seamSub = '';
  if (isWet) {
    seamSub = 'Rule 7: No seam adhesive applied (0.0 ft)';
  } else if (!state.useAdhesive) {
    seamSub = `Bonding disabled: 0.0 ft @ ${formatPHP(ADHESIVE_COST_PER_LN_FT)} / ft`;
  } else if (calc.seamAdhesiveLength === 0) {
    seamSub = `Seamless cut: Fits master roll width (0.0 ft seam) @ ${formatPHP(ADHESIVE_COST_PER_LN_FT)} / ft`;
  } else {
    seamSub = `${calc.seamAdhesiveLength.toFixed(1)} ft raw seam \u2192 ${(calc.seamAdhesiveLength * ADHESIVE_WASTE_FACTOR).toFixed(1)} ft (+5% waste factor) @ ${formatPHP(ADHESIVE_COST_PER_LN_FT)} / ft`;
  }

  // 3. Perimeter Edging Reducer Formula
  let edgingSub = '';
  const edgingRate = calc.edgingProfile === 'low_profile' ? EDGING_LOW_PROFILE_COST : EDGING_HIGH_PROFILE_COST;
  const profileLabel = calc.edgingProfile === 'low_profile' ? 'Low Profile Reducer' : 'High Profile Reducer';
  const presetObj = EDGING_PRESETS[calc.edgingSides] || (calc.edgingSides === 'two_sides' ? EDGING_PRESETS.two_width : EDGING_PRESETS.four_sides);

  if (isWet) {
    edgingSub = 'Rule 7: No perimeter edging reducer applied (0.0 ft)';
  } else if (calc.edgingProfile === 'none' || calc.edgingSides === 'none' || calc.edgingLength === 0) {
    edgingSub = 'No perimeter edging reducer specified (0.0 ft)';
  } else {
    edgingSub = `${profileLabel} \u2013 ${presetObj.name}: ${calc.edgingLength.toFixed(1)} ft @ ${formatPHP(edgingRate)} / ft`;
  }

  // 4. Edging Adhesive Formula
  let edgingAdhesiveSub = '';
  if (isWet) {
    edgingAdhesiveSub = 'Rule 7: No edging adhesive applied (0.0 ft)';
  } else if (!state.useAdhesive || calc.edgingProfile === 'none' || calc.edgingSides === 'none' || calc.edgingLength === 0) {
    edgingAdhesiveSub = 'No edging adhesive required (0.0 ft)';
  } else {
    edgingAdhesiveSub = `Adhesive for ${presetObj.label || presetObj.short}: ${calc.edgingLength.toFixed(1)} ft raw \u2192 ${(calc.edgingLength * ADHESIVE_WASTE_FACTOR).toFixed(1)} ft (+5% waste factor) @ ${formatPHP(ADHESIVE_COST_PER_LN_FT)} / ft`;
  }

  const laborSub = 'Standard fabrication, cutting & assembly fee @ \u20B1100.00 / order';
  const totalSub = 'Direct sum of master roll material, adhesive bonding & fixed labor';

  return {
    mattingSub,
    seamSub,
    edgingSub,
    edgingAdhesiveSub,
    laborSub,
    totalSub
  };
}

// 7. UI Synchronization & Update
function updateUI() {
  const calc = calculateOrder(state);
  const spec = MAT_SPECS[state.matType];
  const isWet = state.matType === 'wet_area_3';

  // Ensure Header title and subtitle are permanently set for Commercial Pricing
  const appTitle = document.getElementById('app-title');
  const appSubtitle = document.getElementById('app-subtitle');
  if (appTitle) appTitle.textContent = 'Commercial Matting & Pricing Calculator';
  if (appSubtitle) appSubtitle.textContent = 'Precision industrial manufacturing and commercial estimating engine';

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

  document.querySelectorAll('[data-type]').forEach(btn => {
    btn.disabled = isWet;
    btn.classList.toggle('active', state.edgingProfile === btn.dataset.type && !isWet);
  });

  document.querySelectorAll('[data-sides]').forEach(btn => {
    btn.disabled = isWet;
    const isProfileNone = state.edgingProfile === 'none';
    const isNoneBtn = btn.dataset.sides === 'none';

    const isActive = !isWet && (
      (isProfileNone && isNoneBtn) ||
      (!isProfileNone && (state.edgingSides === btn.dataset.sides || (btn.dataset.sides === 'two_width' && state.edgingSides === 'two_width_sides')))
    );
    btn.classList.toggle('active', isActive);

    // Dim buttons gracefully when Profile is None (except for 'No Edging')
    if (!isWet && isProfileNone && !isNoneBtn) {
      btn.classList.add('dimmed');
    } else {
      btn.classList.remove('dimmed');
    }
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

  if (!state.isAdmin) {
    // Customer/Public view: Specifications and commercial proposal visible; itemized direct costs locked
    summaryKicker.textContent = 'Commercial Proposal';
    summaryTitle.textContent = '6. Specifications & Commercial Valuation';
    summaryBadge.textContent = 'Commercial Offer';
    matMetricsView.classList.remove('hidden');
    costBreakdownView.classList.add('hidden');
    if (lockedNotice) lockedNotice.classList.remove('hidden');
  } else {
    // Authenticated Administrator view: Full visibility into direct cost breakdown
    summaryKicker.textContent = 'Commercial Proposal';
    summaryTitle.textContent = 'Itemized Cost Breakdown';
    summaryBadge.textContent = `${state.region} / ${state.bracket}`;
    matMetricsView.classList.add('hidden');
    costBreakdownView.classList.remove('hidden');
    if (lockedNotice) lockedNotice.classList.add('hidden');
  }

  // Update Material Metrics View (Public & Materials Mode)
  document.getElementById('mat-usage-dimensions').textContent = isWet
    ? `3.0 ft x ${calc.roundedLength}.0 ft`
    : `${calc.width.toFixed(1)} ft x ${calc.length.toFixed(1)} ft`;
  document.getElementById('mat-usage-subtext').textContent = isWet
    ? `Charged 3.0 ft x ${calc.roundedLength}.0 ft standard cut (Area: ${(3 * calc.roundedLength).toFixed(1)} sq. ft.)`
    : `${calc.cols} x ${calc.rows} panel segments | Total Area: ${(calc.width * calc.length).toFixed(1)} sq. ft.`;
  document.getElementById('adhesive-usage-length').textContent = `${calc.adhesiveLengthWithWaste.toFixed(1)} ln. ft.`;
  document.getElementById('adhesive-usage-subtext').textContent = `Seams: ${calc.seamAdhesiveLength.toFixed(1)} ft + Edging: ${calc.edgingAdhesiveLength.toFixed(1)} ft (+5% waste factor)`;
  const presetCurrent = EDGING_PRESETS[calc.edgingSides] || (calc.edgingSides === 'two_sides' ? EDGING_PRESETS.two_width : EDGING_PRESETS.none);
  const profileCurrent = calc.edgingProfile === 'low_profile' ? 'Low Profile Reducer' : calc.edgingProfile === 'high_profile' ? 'High Profile Reducer' : 'None';
  document.getElementById('edging-usage-length').textContent = calc.edgingProfile === 'none' || calc.edgingSides === 'none' || isWet ? 'No Edging Applied' : `${calc.edgingLength.toFixed(1)} ln. ft.`;
  document.getElementById('edging-usage-subtext').textContent = calc.edgingProfile === 'none' || calc.edgingSides === 'none' || isWet
    ? 'No border reducer specified'
    : `${profileCurrent} \u2022 ${presetCurrent.name}`;

  // Update Itemized Cost Breakdown View (Internal Admin)
  const detail = getDetailedCostStrings(calc, spec);

  const elCostMatting = document.getElementById('cost-val-matting');
  if (elCostMatting) elCostMatting.textContent = formatPHP(calc.mattingCost);
  const elCostSubMatting = document.getElementById('cost-sub-matting');
  if (elCostSubMatting) elCostSubMatting.textContent = detail.mattingSub;

  const elCostAdhesive = document.getElementById('cost-val-adhesive');
  if (elCostAdhesive) elCostAdhesive.textContent = formatPHP(calc.seamAdhesiveCost);
  const elCostSubAdhesive = document.getElementById('cost-sub-adhesive');
  if (elCostSubAdhesive) elCostSubAdhesive.textContent = detail.seamSub;

  const elCostEdging = document.getElementById('cost-val-edging');
  if (elCostEdging) elCostEdging.textContent = formatPHP(calc.edgingCost);
  const elCostSubEdging = document.getElementById('cost-sub-edging');
  if (elCostSubEdging) elCostSubEdging.textContent = detail.edgingSub;

  const elCostEdgingAdh = document.getElementById('cost-val-edging-adhesive');
  if (elCostEdgingAdh) elCostEdgingAdh.textContent = formatPHP(calc.edgingAdhesiveCost);
  const elCostSubEdgingAdh = document.getElementById('cost-sub-edging-adhesive');
  if (elCostSubEdgingAdh) elCostSubEdgingAdh.textContent = detail.edgingAdhesiveSub;

  const elCostLabor = document.getElementById('cost-val-labor');
  if (elCostLabor) elCostLabor.textContent = formatPHP(calc.laborCost);
  const elCostSubLabor = document.getElementById('cost-sub-labor');
  if (elCostSubLabor) elCostSubLabor.textContent = detail.laborSub;

  const elCostTotal = document.getElementById('cost-val-total');
  if (elCostTotal) elCostTotal.textContent = formatPHP(calc.totalCost);
  const elCostSubTotal = document.getElementById('cost-sub-total');
  if (elCostSubTotal) elCostSubTotal.textContent = detail.totalSub;

  // Pricing Summary
  document.getElementById('price-excl-vat').textContent = formatPHP(calc.sellingPriceExclVat);
  document.getElementById('price-vat').textContent = formatPHP(calc.vatAmount);
  document.getElementById('price-inc-vat').textContent = calc.isValid ? formatPHP(calc.finalSellingPrice) : '₱0.00';
}

// 7. Calculator Reset Handler with Smooth Scroll
function resetCalculator() {
  state.matType = DEFAULT_STATE.matType;
  state.width = DEFAULT_STATE.width;
  state.length = DEFAULT_STATE.length;
  state.useAdhesive = DEFAULT_STATE.useAdhesive;
  state.edgingProfile = DEFAULT_STATE.edgingProfile;
  state.edgingSides = DEFAULT_STATE.edgingSides;
  state.region = DEFAULT_STATE.region;
  state.bracket = DEFAULT_STATE.bracket;

  // Sync inputs
  document.getElementById('width-number-input').value = state.width;
  document.getElementById('width-range-input').value = state.width;
  document.getElementById('length-number-input').value = state.length;
  document.getElementById('length-range-input').value = state.length;
  document.getElementById('bracket-select').value = state.bracket;

  updateUI();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// 8. Event Listeners & Bootstrapping
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

  // Adhesive Buttons
  document.querySelectorAll('[data-adhesive]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.useAdhesive = btn.dataset.adhesive === 'true';
      updateUI();
    });
  });

  // Edging Profile Buttons (Appears BEFORE Edging Application)
  document.querySelectorAll('[data-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.edgingProfile = btn.dataset.type;
      if (btn.dataset.type === 'none') {
        state.edgingSides = 'none';
      } else if (state.edgingSides === 'none') {
        state.edgingSides = 'four_sides';
      }
      updateUI();
    });
  });

  // Edging Sides Buttons (Appears AFTER Edging Profile)
  document.querySelectorAll('[data-sides]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.edgingSides = btn.dataset.sides;
      if (btn.dataset.sides === 'none') {
        state.edgingProfile = 'none';
      } else if (state.edgingProfile === 'none') {
        state.edgingProfile = 'low_profile';
      }
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

  // Calculator Reset Button
  const resetBtn = document.getElementById('btn-reset-calculator');
  if (resetBtn) {
    resetBtn.addEventListener('click', resetCalculator);
  }

  // 1. Customization Rules modal / view (Password Protected)
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

  // 3. Itemized Cost Breakdown modal / view (Password Protected)
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
  document.getElementById('btn-close-rules-modal').addEventListener('click', () => {
    document.getElementById('rules-modal').classList.add('hidden');
  });
  document.getElementById('btn-rules-footer-close').addEventListener('click', () => {
    document.getElementById('rules-modal').classList.add('hidden');
  });

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
  const spec = MAT_SPECS[calc.matType];
  const detail = getDetailedCostStrings(calc, spec);

  // 1. Matting Material
  const elMat = document.getElementById('modal-cost-matting');
  if (elMat) elMat.textContent = formatPHP(calc.mattingCost);
  const elSubMat = document.getElementById('modal-cost-sub-matting');
  if (elSubMat) elSubMat.textContent = detail.mattingSub;

  // 2. Seam Adhesive
  const elSeam = document.getElementById('modal-cost-seam-adhesive');
  if (elSeam) elSeam.textContent = formatPHP(calc.seamAdhesiveCost);
  const elSubSeam = document.getElementById('modal-cost-sub-seam-adhesive');
  if (elSubSeam) elSubSeam.textContent = detail.seamSub;

  // 3. Perimeter Edging Reducer
  const elEdge = document.getElementById('modal-cost-edging');
  if (elEdge) elEdge.textContent = formatPHP(calc.edgingCost);
  const elSubEdge = document.getElementById('modal-cost-sub-edging');
  if (elSubEdge) elSubEdge.textContent = detail.edgingSub;

  // 4. Edging Adhesive Bonding
  const elEdgeAdh = document.getElementById('modal-cost-edging-adhesive');
  if (elEdgeAdh) elEdgeAdh.textContent = formatPHP(calc.edgingAdhesiveCost);
  const elSubEdgeAdh = document.getElementById('modal-cost-sub-edging-adhesive');
  if (elSubEdgeAdh) elSubEdgeAdh.textContent = detail.edgingAdhesiveSub;

  // 5. Fixed Labor Cost
  const elLabor = document.getElementById('modal-cost-labor');
  if (elLabor) elLabor.textContent = formatPHP(calc.laborCost);
  const elSubLabor = document.getElementById('modal-cost-sub-labor');
  if (elSubLabor) elSubLabor.textContent = detail.laborSub;

  // Direct Production Cost Total
  const elTotal = document.getElementById('modal-cost-total');
  if (elTotal) elTotal.textContent = formatPHP(calc.totalCost);
  const elSubTotal = document.getElementById('modal-cost-sub-total');
  if (elSubTotal) elSubTotal.textContent = detail.totalSub;

  // Regional Pricing & Margin Multipliers
  const elBracket = document.getElementById('modal-cost-bracket');
  if (elBracket) elBracket.textContent = `${state.region} Region - ${BRACKET_LABELS[state.bracket]}`;
  const elSubBracket = document.getElementById('modal-cost-sub-bracket');
  if (elSubBracket) elSubBracket.textContent = `${state.region} regional distribution logistics & commercial bracket`;

  const elBasis = document.getElementById('modal-cost-basis');
  if (elBasis) elBasis.textContent = `${(calc.costPercentage * 100).toFixed(0)}%`;
  const elSubBasis = document.getElementById('modal-cost-sub-basis');
  if (elSubBasis) elSubBasis.textContent = `Formula: Selling Price (Excl. VAT) = Direct Cost (${formatPHP(calc.totalCost)}) / ${(calc.costPercentage * 100).toFixed(0)}% Cost Factor`;

  const elExclVat = document.getElementById('modal-cost-excl-vat');
  if (elExclVat) elExclVat.textContent = formatPHP(calc.sellingPriceExclVat);

  const elVat = document.getElementById('modal-cost-vat');
  if (elVat) elVat.textContent = formatPHP(calc.vatAmount);

  const elIncVat = document.getElementById('modal-cost-inc-vat');
  if (elIncVat) elIncVat.textContent = formatPHP(calc.finalSellingPrice);

  document.getElementById('cost-breakdown-modal').classList.remove('hidden');
}
