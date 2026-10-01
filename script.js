/**
 * Commercial Matting Estimator & Pricing Calculator
 * Pure Vanilla JavaScript (ES6) Engine - Isolated Client-Side Execution
 * Implements Rules 1-8, Master Roll Matting Costs, Seam Adhesive Bonding (+5% Waste),
 * Edging, and Two-Part Pricing with Regional Margin Brackets.
 */

// 1. Master Matting Specifications & Data Constants
const MAT_SPECS = {
  heavy_8250: {
    id: 'heavy_8250',
    name: 'Heavy Traffic 8250',
    standardWidth: 3,
    standardLength: 20,
    costPerSqFt: 535.30,
    desc: 'Unbacked open vinyl z-web construction'
  },
  medium_6050: {
    id: 'medium_6050',
    name: 'Medium Traffic 6050',
    standardWidth: 3,
    standardLength: 78,
    costPerSqFt: 279.18,
    desc: 'Backed vinyl coiled loop matting'
  },
  carpet_3100_3: {
    id: 'carpet_3100_3',
    name: 'Carpet 3100 (3 ft Width)',
    standardWidth: 3,
    standardLength: 60,
    costPerSqFt: 333.89,
    desc: 'Ribbed carpet texture + Factory-built length edging'
  },
  carpet_3100_4: {
    id: 'carpet_3100_4',
    name: 'Carpet 3100 (4 ft Width)',
    standardWidth: 4,
    standardLength: 60,
    costPerSqFt: 302.84,
    desc: 'Ribbed carpet texture + Factory-built length edging'
  },
  wet_area_3: {
    id: 'wet_area_3',
    name: 'Wet Area Mat',
    standardWidth: 3,
    standardLength: 40,
    costPerSqFt: 381.58,
    desc: 'Rubber drainage matting (Rule 8 strictly applies)'
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

// Fixed Application Parameters
const ADHESIVE_COST_PER_LN_FT = 18.62; // ₱1,117.73 / 60 ft tube
const ADHESIVE_WASTE_FACTOR = 1.05;    // +5% waste factor
const EDGING_LOW_PROFILE_COST = 70.79;
const EDGING_HIGH_PROFILE_COST = 204.51;
const FIXED_LABOR_COST = 100.00;       // ₱100.00 per job order
const VAT_RATE = 0.12;                 // Statutory 12% Philippine VAT

// Functional Edging Application Presets
const EDGING_PRESETS = {
  none: {
    id: 'none',
    name: 'No Edging',
    label: 'No Edging',
    short: 'No Edging'
  },
  two_width: {
    id: 'two_width',
    name: '2 Width Sides (Traffic Entrance & Exit Ends)',
    label: '2 Width Sides',
    short: '2 Width Sides'
  },
  two_length: {
    id: 'two_length',
    name: '2 Length Sides (Corridor/Walkway Borders)',
    label: '2 Length Sides',
    short: '2 Length Sides'
  },
  four_sides: {
    id: 'four_sides',
    name: 'All 4 Sides (Full Perimeter)',
    label: 'All 4 Sides',
    short: 'All 4 Sides'
  }
};

// In-Memory Application State & Manual Override Tracking
const DEFAULT_STATE = {
  matType: 'heavy_8250',
  width: 5,
  length: 12,
  useAdhesive: true,
  edgingProfile: 'none',
  edgingSides: 'none',
  region: 'Luzon',
  bracket: 'SRP',
  isAdmin: false,
  isAdhesiveOverridden: false,
  isEdgingProfileOverridden: false,
  isEdgingSidesOverridden: false
};

const state = { ...DEFAULT_STATE };

// Administrative Authentication & Override State
const ADMIN_PASSWORD = 'grb123';
let pendingAdminAction = null;
let pendingOverrideAction = null;

// 2. Format Currency (Philippine Peso ₱XX,XXX.XX)
function formatPHP(num) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num || 0);
}

// 3. Automatic Detection Engine
function getAutoSettings(matType, width, length) {
  const spec = MAT_SPECS[matType];
  const isWidthExceeded = width > spec.standardWidth;
  const isLengthExceeded = length > spec.standardLength;
  
  // Automatically enable seam adhesive if dimensions exceed standard master roll
  let autoAdhesive = (isWidthExceeded || isLengthExceeded);
  let autoEdgingSides = 'none';
  let autoEdgingProfile = 'none';

  if (matType === 'carpet_3100_3' || matType === 'carpet_3100_4') {
    // Carpet 3100 Rule 7: Factory length edges exist. Default edging to 2 raw cut width ends.
    autoEdgingSides = 'two_width';
    autoEdgingProfile = 'low_profile';
  } else if (matType === 'wet_area_3') {
    // Wet Area Mat Rule 8: Seam adhesive & applied edging strictly disabled.
    autoAdhesive = false;
    autoEdgingSides = 'none';
    autoEdgingProfile = 'none';
  } else {
    // Heavy Traffic 8250 & Medium Traffic 6050: Default to No Edging
    autoEdgingSides = 'none';
    autoEdgingProfile = 'none';
  }
  
  return { 
    useAdhesive: autoAdhesive, 
    edgingSides: autoEdgingSides, 
    edgingProfile: autoEdgingProfile 
  };
}

function applyAutoDetection() {
  const auto = getAutoSettings(state.matType, state.width, state.length);
  
  if (!state.isAdhesiveOverridden) {
    state.useAdhesive = auto.useAdhesive;
  }
  if (!state.isEdgingProfileOverridden) {
    state.edgingProfile = auto.edgingProfile;
  }
  if (!state.isEdgingSidesOverridden) {
    state.edgingSides = auto.edgingSides;
  }
}

// 4. Calculation Core Engine (Two-Part Pricing Engine & Rules 1-8)
function calculateOrder(input) {
  const { matType, width, length, edgingProfile, edgingSides, region, bracket, useAdhesive } = input;
  const spec = MAT_SPECS[matType];

  const res = {
    matType, width, length, edgingProfile, edgingSides, region, bracket, useAdhesive,
    cols: 1, rows: 1, roundedLength: 0, activeRule: '', ruleDescription: '',
    seamAdhesiveLength: 0, edgingLength: 0, edgingAdhesiveLength: 0,
    totalAdhesiveLength: 0, adhesiveLengthWithWaste: 0,
    
    mattingCost: 0, seamAdhesiveCost: 0, edgingCost: 0, edgingAdhesiveCost: 0,
    laborCost: FIXED_LABOR_COST,
    
    part1DirectCost: 0, part1PriceExclVat: 0,
    part2DirectCost: 0, part2PriceExclVat: 0,
    
    totalCost: 0, costPercentage: COST_PERCENTAGES[region]?.[bracket] || 0.73,
    sellingPriceExclVat: 0, vatAmount: 0, finalSellingPrice: 0,
    isValid: true, errorMessage: ''
  };

  if (!spec) {
    res.isValid = false; res.errorMessage = 'Invalid mat type selected.'; return res;
  }
  if (width <= 0 || length <= 0 || isNaN(width) || isNaN(length)) {
    res.isValid = false; res.errorMessage = 'Width and length must be numbers greater than zero.'; return res;
  }

  const isCarpet = matType.startsWith('carpet_3100');
  const isWetArea = matType === 'wet_area_3';

  // Assembly Rules Logic (1 - 8)
  if (isWetArea) {
    // Rule 8: Wet Area Mat Special Exception
    if (width > 3) {
      res.isValid = false;
      res.errorMessage = 'Rule 8: Wet Area Mat cannot exceed 3.0 ft width limit.';
      return res;
    }
    if (length > 10) {
      res.isValid = false;
      res.errorMessage = 'Rule 8: Wet Area Mat custom length cannot exceed 10.0 ft limit.';
      return res;
    }

    const allowableLengths = [2, 4, 8, 10];
    let charged = 10;
    for (const std of allowableLengths) {
      if (length <= std) {
        charged = std;
        break;
      }
    }
    res.roundedLength = charged;
    res.cols = 1; res.rows = 1;
    res.activeRule = 'Rule 8: Wet Area Mat Special Exception (3 ft x 40 ft Master Roll)';
    res.ruleDescription = `Custom length of ${length.toFixed(1)} ft automatically rounds UP to ${charged}.0 ft chargeable standard length cut. Leftover cut material is non-reusable scrap. No seam adhesive or perimeter edging permitted.`;

    res.mattingCost = (3.0 * res.roundedLength) * spec.costPerSqFt;
    res.seamAdhesiveLength = 0;
    res.edgingLength = 0;
    res.edgingAdhesiveLength = 0;

  } else {
    // Standard and Carpet Matting Rules 1-7
    res.cols = Math.ceil(width / spec.standardWidth);
    res.rows = Math.ceil(length / spec.standardLength);

    const isWidthExceeded = width > spec.standardWidth;
    const isLengthExceeded = length > spec.standardLength;
    const hasEdging = edgingProfile !== 'none' && edgingSides !== 'none';
    const is4SideEdging = hasEdging && edgingSides === 'four_sides';

    // Seam adhesive length calculations from actual manufacturing cuts
    const longSeams = res.cols > 1 ? (res.cols - 1) * length : 0;
    const transSeams = res.rows > 1 ? (res.rows - 1) * width : 0;
    res.seamAdhesiveLength = useAdhesive ? (longSeams + transSeams) : 0;

    // Edging length calculations
    if (hasEdging) {
      if (edgingSides === 'four_sides') res.edgingLength = (2 * width) + (2 * length);
      else if (edgingSides === 'two_width') res.edgingLength = 2 * width;
      else if (edgingSides === 'two_length') res.edgingLength = 2 * length;
    } else {
      res.edgingLength = 0;
    }
    res.edgingAdhesiveLength = useAdhesive ? res.edgingLength : 0;

    // Active Assembly Rule Identification
    if (isCarpet) {
      if (isWidthExceeded && isLengthExceeded) {
        if (is4SideEdging) {
          res.activeRule = 'Rule 6 & 7: Grid Expansion with 4-Side Edging (Carpet 3100)';
          res.ruleDescription = `Grid assembly required (${res.cols} cols x ${res.rows} rows). Longitudinal and transverse seam adhesive applied. Selected 4-side edging profile applied around outer perimeter.`;
        } else {
          res.activeRule = 'Rule 3 & 7: Grid Expansion (Carpet 3100 Built-In Edging)';
          res.ruleDescription = `Grid assembly required (${res.cols} cols x ${res.rows} rows). Seam adhesive applied along all grid seams. Factory length edging exists on outer roll edges; raw width ends edged per selection.`;
        }
      } else if (isWidthExceeded) {
        if (is4SideEdging) {
          res.activeRule = 'Rule 4 & 7: Exceeding Standard Width with 4-Side Edging (Carpet 3100)';
          res.ruleDescription = `Master roll sliced into ${res.cols} width panels joined with longitudinal seam adhesive. Selected edging profile applied around all 4 outer sides.`;
        } else {
          res.activeRule = 'Rule 1 & 7: Exceeding Standard Width (Carpet 3100)';
          res.ruleDescription = `Master roll sliced into ${res.cols} width panels joined along longitudinal seams. Factory edging exists along length; raw width ends finished per selection.`;
        }
      } else if (isLengthExceeded) {
        if (is4SideEdging) {
          res.activeRule = 'Rule 5 & 7: Exceeding Standard Length with 4-Side Edging (Carpet 3100)';
          res.ruleDescription = `Length rolls butt-jointed end-to-end with transverse seam adhesive. Selected edging profile applied around all 4 outer sides.`;
        } else {
          res.activeRule = 'Rule 2 & 7: Exceeding Standard Length (Carpet 3100)';
          res.ruleDescription = `Segments butt-jointed end-to-end with transverse seam adhesive. Factory edging exists along length; raw width ends finished per selection.`;
        }
      } else {
        res.activeRule = 'Rule 7: Carpet 3100 Built-In Edging Exception';
        res.ruleDescription = `Factory edging is manufactured directly into both length sides of the master roll. Applied edging defaults strictly to 2 Width Sides (2 x Width) to finish raw cut width ends.`;
      }
    } else {
      // Heavy Traffic 8250 or Medium Traffic 6050
      if (isWidthExceeded && isLengthExceeded) {
        if (is4SideEdging) {
          res.activeRule = 'Rule 6: Exceeding Standard Width & Length with 4-Side Edging';
          res.ruleDescription = `Grid assembly required (${res.cols} cols x ${res.rows} rows). Both width and length exceed master roll. Seam adhesive applied along longitudinal and transverse grid seams. Edging applied to all 4 outer sides.`;
        } else {
          res.activeRule = 'Rule 3: Exceeding Standard Width & Length w/o Edging';
          res.ruleDescription = `Grid assembly required (${res.cols} cols x ${res.rows} rows). Both width and length exceed master roll. Seam adhesive applied along both longitudinal and transverse grid seams.`;
        }
      } else if (isWidthExceeded) {
        if (is4SideEdging) {
          res.activeRule = 'Rule 4: Exceeding Standard Width with 4-Side Edging';
          res.ruleDescription = `Width panels joined with longitudinal seam adhesive. Selected edging profile applied around all 4 outer sides. Perimeter = 2 x Width + 2 x Length.`;
        } else {
          res.activeRule = 'Rule 1: Exceeding Standard Width w/o Edging';
          res.ruleDescription = `Width exceeds standard roll size (${spec.standardWidth} ft). Master roll sliced into ${res.cols} width panels joined with longitudinal seam adhesive.`;
        }
      } else if (isLengthExceeded) {
        if (is4SideEdging) {
          res.activeRule = 'Rule 5: Exceeding Standard Length with 4-Side Edging';
          res.ruleDescription = `Length rolls butt-jointed end-to-end with transverse seam adhesive. Selected edging profile applied around all 4 outer sides. Perimeter = 2 x Width + 2 x Length.`;
        } else {
          res.activeRule = 'Rule 2: Exceeding Standard Length w/o Edging';
          res.ruleDescription = `Length exceeds standard roll size (${spec.standardLength} ft). Additional roll segments butt-jointed end-to-end with transverse seam adhesive.`;
        }
      } else {
        res.activeRule = 'Standard Roll Cut';
        res.ruleDescription = `Single continuous panel extracted from standard master roll (${spec.standardWidth} ft x ${spec.standardLength} ft).`;
      }
    }

    res.mattingCost = width * length * spec.costPerSqFt;
  }

  // Accessories Evaluation (+5% waste factor)
  res.totalAdhesiveLength = res.seamAdhesiveLength + res.edgingAdhesiveLength;
  res.adhesiveLengthWithWaste = res.totalAdhesiveLength * ADHESIVE_WASTE_FACTOR;

  const edgingRate = edgingProfile === 'low_profile' ? EDGING_LOW_PROFILE_COST : edgingProfile === 'high_profile' ? EDGING_HIGH_PROFILE_COST : 0;
  res.edgingCost = res.edgingLength * edgingRate;
  res.seamAdhesiveCost = res.seamAdhesiveLength * ADHESIVE_WASTE_FACTOR * ADHESIVE_COST_PER_LN_FT;
  res.edgingAdhesiveCost = res.edgingAdhesiveLength * ADHESIVE_WASTE_FACTOR * ADHESIVE_COST_PER_LN_FT;

  // TWO-PART PRICING ENGINE
  // Part 1: Matting Material + Fixed Labor Cost (Divisor = Regional Cost Basis)
  res.part1DirectCost = res.mattingCost + res.laborCost;
  res.part1PriceExclVat = res.part1DirectCost / res.costPercentage;

  // Part 2: Accessories Valuation (Adhesive + Edging with +5% waste factor) / 0.85 margin basis
  res.part2DirectCost = res.seamAdhesiveCost + res.edgingCost + res.edgingAdhesiveCost;
  res.part2PriceExclVat = res.part2DirectCost > 0 ? (res.part2DirectCost / 0.85) : 0;

  // Total Valuation & Statutory VAT (12%)
  res.totalCost = res.part1DirectCost + res.part2DirectCost;
  res.sellingPriceExclVat = res.part1PriceExclVat + res.part2PriceExclVat;
  res.vatAmount = res.sellingPriceExclVat * VAT_RATE;
  res.finalSellingPrice = res.sellingPriceExclVat * (1 + VAT_RATE);

  return res;
}

// 5. Blueprint Canvas Rendering Engine (Dynamic SVG)
function renderBlueprint(calc) {
  const container = document.getElementById('blueprint-canvas-container');
  const scaleTag = document.getElementById('blueprint-scale-tag');

  if (!calc.isValid || calc.width <= 0 || calc.length <= 0) {
    scaleTag.textContent = 'Scale: N/A';
    container.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:12px; padding:1.5rem 0;">Dimension constraint prevents layout preview</div>';
    return;
  }

  const spec = MAT_SPECS[calc.matType];
  const physLen = calc.matType === 'wet_area_3' ? calc.roundedLength : calc.length;
  const physWid = calc.matType === 'wet_area_3' ? 3 : calc.width;

  const pad = 30;
  const scale = Math.min((420 - 2 * pad) / physWid, (160 - 2 * pad) / physLen, 28);
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
    <!-- Base Mat Canvas -->
    <rect x="${pad}" y="${pad}" width="${w}" height="${h}" fill="#cbd5e1" stroke="#94a3b8" stroke-width="1.5" rx="2" />`;

  // Carpet 3100 Parallel Texture Ribs & Built-In Factory Edging Graphics
  const isCarpet = calc.matType.startsWith('carpet_3100');
  if (isCarpet) {
    // Render vertical parallel solid lines running along the length axis
    for (let x = pad + 6; x < pad + w - 4; x += 6) {
        svg += `<line x1="${x}" y1="${pad}" x2="${x}" y2="${pad + h}" class="rib-line" />`;
    }
    // Render distinct factory built-in length edges along both length sides
    svg += `<rect x="${pad}" y="${pad}" width="4" height="${h}" class="factory-edge" />`;
    svg += `<rect x="${pad + w - 4}" y="${pad}" width="4" height="${h}" class="factory-edge" />`;
  }

  if (calc.matType === 'wet_area_3') {
    // Requested customer area
    svg += `<rect x="${pad}" y="${pad}" width="${calc.width * scale}" height="${calc.length * scale}" fill="#94a3b8" stroke="#64748b" stroke-width="1" />`;
    // Discarded charged cut strips (non-reusable scrap waste)
    if (calc.width < 3) {
      svg += `<rect x="${pad + calc.width * scale}" y="${pad}" width="${(3 - calc.width) * scale}" height="${physLen * scale}" fill="url(#waste-stripe)" opacity="0.75" />`;
    }
    if (calc.length < calc.roundedLength) {
      svg += `<rect x="${pad}" y="${pad + calc.length * scale}" width="${calc.width * scale}" height="${(calc.roundedLength - calc.length) * scale}" fill="url(#waste-stripe)" opacity="0.75" />`;
    }
  } else {
    // Joining Seams (Only render seams actually calculated by engine)
    for (let c = 1; c < calc.cols; c++) {
      const cx = pad + c * spec.standardWidth * scale;
      svg += `<line x1="${cx}" y1="${pad}" x2="${cx}" y2="${pad + h}" stroke="#ef4444" stroke-width="2" stroke-dasharray="3 3" />`;
    }
    for (let r = 1; r < calc.rows; r++) {
      const cy = pad + r * spec.standardLength * scale;
      svg += `<line x1="${pad}" y1="${cy}" x2="${pad + w}" y2="${cy}" stroke="#ef4444" stroke-width="2" stroke-dasharray="3 3" />`;
    }

    // Applied Edging Border Visualization
    if (calc.edgingProfile !== 'none' && calc.edgingSides !== 'none') {
      if (calc.edgingSides === 'four_sides') {
        svg += `<rect x="${pad - 2}" y="${pad - 3}" width="${w + 4}" height="4" fill="${edgingColor}" rx="1" />
                <rect x="${pad - 2}" y="${pad + h - 1}" width="${w + 4}" height="4" fill="${edgingColor}" rx="1" />
                <rect x="${pad - 3}" y="${pad - 2}" width="4" height="${h + 4}" fill="${edgingColor}" rx="1" />
                <rect x="${pad + w - 1}" y="${pad - 2}" width="4" height="${h + 4}" fill="${edgingColor}" rx="1" />`;
      } else if (calc.edgingSides === 'two_width') {
        svg += `<rect x="${pad}" y="${pad - 3}" width="${w}" height="4" fill="${edgingColor}" rx="1" />
                <rect x="${pad}" y="${pad + h - 1}" width="${w}" height="4" fill="${edgingColor}" rx="1" />`;
      } else if (calc.edgingSides === 'two_length') {
        svg += `<rect x="${pad - 3}" y="${pad}" width="4" height="${h}" fill="${edgingColor}" rx="1" />
                <rect x="${pad + w - 1}" y="${pad}" width="4" height="${h}" fill="${edgingColor}" rx="1" />`;
      }
    }
  }

  // Dimension Callouts & Text Labels
  svg += `<line x1="${pad}" y1="${pad - 10}" x2="${pad + w}" y2="${pad - 10}" stroke="#64748b" stroke-width="1"/>
          <text x="${pad + w / 2}" y="${pad - 13}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700" fill="#334155">${calc.width} ft</text>
          <line x1="${pad - 10}" y1="${pad}" x2="${pad - 10}" y2="${pad + h}" stroke="#64748b" stroke-width="1"/>
          <text x="${pad - 14}" y="${pad + h / 2}" text-anchor="middle" transform="rotate(-90 ${pad - 14} ${pad + h / 2})" font-family="JetBrains Mono, monospace" font-size="9" font-weight="700" fill="#334155">${calc.length} ft</text>
          <text x="${pad + w / 2}" y="${pad + h / 2 + 3}" text-anchor="middle" font-family="Montserrat, sans-serif" font-size="9" font-weight="700" fill="#0f172a">${calc.matType === 'wet_area_3' ? `Charged 3.0 x ${calc.roundedLength}.0 ft` : `${calc.cols} x${calc.rows} Panels`}</text>
  </svg>`;

  container.innerHTML = svg;

  // Synchronize Legends with Calculation State
  const seamLeg = document.getElementById('legend-seam-item');
  if (calc.seamAdhesiveLength > 0 && calc.matType !== 'wet_area_3') {
    seamLeg.classList.remove('hidden');
    document.getElementById('legend-seam-text').textContent = `Adhesive Seam (${calc.seamAdhesiveLength.toFixed(1)} ft)`;
  } else {
    seamLeg.classList.add('hidden');
  }

  const edgeLeg = document.getElementById('legend-edging-item');
  if (calc.edgingProfile !== 'none' && calc.edgingSides !== 'none' && calc.matType !== 'wet_area_3') {
    edgeLeg.classList.remove('hidden');
    document.getElementById('legend-edging-swatch').style.backgroundColor = edgingColor;
    const profileLabel = calc.edgingProfile === 'low_profile' ? 'Low Profile' : 'High Profile';
    const presetObj = EDGING_PRESETS[calc.edgingSides] || EDGING_PRESETS.four_sides;
    document.getElementById('legend-edging-text').textContent = `Applied ${profileLabel} \u2013 ${presetObj.short} (${calc.edgingLength.toFixed(1)} ft)`;
  } else {
    edgeLeg.classList.add('hidden');
  }

  const factoryLeg = document.getElementById('legend-factory-item');
  factoryLeg.classList.toggle('hidden', !isCarpet);

  const wasteLeg = document.getElementById('legend-waste-item');
  const hasWaste = calc.matType === 'wet_area_3' && (calc.width < 3 || calc.length < calc.roundedLength);
  wasteLeg.classList.toggle('hidden', !hasWaste);
}

// 6. Detailed Manufacturing Data Generators
function getDetailedCostStrings(calc, spec) {
  const isWet = calc.matType === 'wet_area_3';

  const mattingSub = isWet
    ? `Rule 8: Charged 3.0 ft \u00D7 ${calc.roundedLength}.0 ft (${(3.0 * calc.roundedLength).toFixed(1)} sq. ft.) @ ${formatPHP(spec.costPerSqFt)} / sq. ft.`
    : `${calc.width.toFixed(1)} ft \u00D7 ${calc.length.toFixed(1)} ft (${(calc.width * calc.length).toFixed(1)} sq. ft.) @ ${formatPHP(spec.costPerSqFt)} / sq. ft.`;

  let seamSub = '';
  if (isWet) seamSub = 'Rule 8: No seam adhesive permitted (0.0 ft)';
  else if (!state.useAdhesive) seamSub = `Bonding disabled: 0.0 ft @ ${formatPHP(ADHESIVE_COST_PER_LN_FT)} / ft`;
  else if (calc.seamAdhesiveLength === 0) seamSub = `Seamless cut: Fits master roll width (0.0 ft seam) @ ${formatPHP(ADHESIVE_COST_PER_LN_FT)} / ft`;
  else seamSub = `${calc.seamAdhesiveLength.toFixed(1)} ft raw seam \u2192 ${(calc.seamAdhesiveLength * ADHESIVE_WASTE_FACTOR).toFixed(1)} ft (+5% waste factor) @ ${formatPHP(ADHESIVE_COST_PER_LN_FT)} / ft`;

  let edgingSub = '';
  const edgingRate = calc.edgingProfile === 'low_profile' ? EDGING_LOW_PROFILE_COST : EDGING_HIGH_PROFILE_COST;
  const profileLabel = calc.edgingProfile === 'low_profile' ? 'Low Profile Edging' : 'High Profile Edging';
  const presetObj = EDGING_PRESETS[calc.edgingSides] || EDGING_PRESETS.four_sides;

  if (isWet) edgingSub = 'Rule 8: No perimeter edging permitted (0.0 ft)';
  else if (calc.edgingProfile === 'none' || calc.edgingSides === 'none' || calc.edgingLength === 0) edgingSub = 'No perimeter edging specified (0.0 ft)';
  else edgingSub = `${profileLabel} \u2013 ${presetObj.name}: ${calc.edgingLength.toFixed(1)} ft @ ${formatPHP(edgingRate)} / ft`;

  let edgingAdhesiveSub = '';
  if (isWet) edgingAdhesiveSub = 'Rule 8: No edging adhesive permitted (0.0 ft)';
  else if (!state.useAdhesive || calc.edgingProfile === 'none' || calc.edgingSides === 'none' || calc.edgingLength === 0) edgingAdhesiveSub = 'No edging adhesive required (0.0 ft)';
  else edgingAdhesiveSub = `Adhesive for ${presetObj.label || presetObj.short}: ${calc.edgingLength.toFixed(1)} ft raw \u2192 ${(calc.edgingLength * ADHESIVE_WASTE_FACTOR).toFixed(1)} ft (+5% waste factor) @ ${formatPHP(ADHESIVE_COST_PER_LN_FT)} / ft`;

  return { mattingSub, seamSub, edgingSub, edgingAdhesiveSub };
}

// 7. UI Synchronization & Automatic Detection Indicators
function updateUI() {
  const calc = calculateOrder(state);
  const spec = MAT_SPECS[state.matType];
  const isWet = state.matType === 'wet_area_3';

  // Admin Toggle Button
  const adminAuthBtn = document.getElementById('admin-auth-toggle-btn');
  const adminAuthLabel = document.getElementById('admin-auth-label');
  if (adminAuthBtn && adminAuthLabel) {
    if (state.isAdmin) {
      adminAuthBtn.className = 'btn btn-xs btn-admin-active';
      adminAuthLabel.textContent = 'Admin Unlocked (Lock)';
    } else {
      adminAuthBtn.className = 'btn btn-xs btn-secondary';
      adminAuthLabel.textContent = 'Admin Login';
    }
  }

  // Render Grid Selection
  const grid = document.getElementById('mat-type-grid');
  grid.innerHTML = '';
  Object.values(MAT_SPECS).forEach(s => {
    const isSelected = state.matType === s.id;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `mat-btn ${isSelected ? 'selected' : ''}`;
    btn.setAttribute('data-id', s.id);

    const costHtml = state.isAdmin ? `<div class="mat-btn-cost"><span class="text-xs text-muted">Base Cost / Sq. Ft:</span><span class="mat-btn-rate">${formatPHP(s.costPerSqFt)}</span></div>` : '';
    btn.innerHTML = `<div class="mat-btn-head"><div><span class="mat-btn-name">${s.name}</span><span class="mat-btn-dim">${s.standardWidth} ft &times; ${s.standardLength} ft Master Roll</span></div>${isSelected ? '<span class="check-badge">&check;</span>' : ''}</div>${costHtml}`;

    btn.addEventListener('click', () => {
      state.matType = s.id;
      // Reset manual override flags when changing product selection
      state.isAdhesiveOverridden = false;
      state.isEdgingProfileOverridden = false;
      state.isEdgingSidesOverridden = false;
      applyAutoDetection();
      
      // Enforce bounds when switching mat types
      if (s.id === 'wet_area_3') {
        if (state.width > 3) state.width = 3;
        if (state.length > 10) state.length = 10;
      }
      
      document.getElementById('width-number-input').value = state.width;
      document.getElementById('width-range-input').value = state.width;
      document.getElementById('length-number-input').value = state.length;
      document.getElementById('length-range-input').value = state.length;
      updateUI();
    });
    grid.appendChild(btn);
  });

  // Auto-Detection vs Override Status Badges
  const adhesiveBadge = document.getElementById('adhesive-status-badge');
  if (adhesiveBadge) {
    if (isWet) {
      adhesiveBadge.className = 'badge-override';
      adhesiveBadge.textContent = 'Disabled (Rule 8)';
    } else if (state.isAdhesiveOverridden) {
      adhesiveBadge.className = 'badge-override';
      adhesiveBadge.textContent = 'Manual Override';
    } else {
      adhesiveBadge.className = 'badge-auto';
      adhesiveBadge.textContent = 'Auto-Detected';
    }
  }

  const edgingBadge = document.getElementById('edging-status-badge');
  if (edgingBadge) {
    if (isWet) {
      edgingBadge.className = 'badge-override';
      edgingBadge.textContent = 'Disabled (Rule 8)';
    } else if (state.isEdgingProfileOverridden || state.isEdgingSidesOverridden) {
      edgingBadge.className = 'badge-override';
      edgingBadge.textContent = 'Manual Override';
    } else if (state.matType.startsWith('carpet_3100')) {
      edgingBadge.className = 'badge-auto';
      edgingBadge.textContent = '2-Width Auto Default';
    } else {
      edgingBadge.className = 'badge-auto';
      edgingBadge.textContent = 'Auto-Detected';
    }
  }

  // Sliders and Notices
  document.getElementById('width-range-input').max = isWet ? '3' : '20';
  document.getElementById('length-range-input').max = isWet ? '10' : '100';
  document.getElementById('width-cap-notice').classList.toggle('hidden', !isWet);
  document.getElementById('width-max-label').textContent = isWet ? 'Max: 3.0 ft' : 'Max: 20.0 ft';
  document.getElementById('length-rounding-notice').classList.toggle('hidden', !isWet);
  document.getElementById('length-max-label').textContent = isWet ? 'Max: 10.0 ft' : 'Max: 100.0 ft';
  document.getElementById('wet-area-notice-box').classList.toggle('hidden', !isWet);

  const errBox = document.getElementById('sizing-error-box');
  if (!calc.isValid && calc.errorMessage) {
    errBox.classList.remove('hidden');
    document.getElementById('sizing-error-message').textContent = calc.errorMessage;
  } else {
    errBox.classList.add('hidden');
  }

  // Active Rule Indicator
  const ruleCard = document.getElementById('active-rule-card');
  if (ruleCard) {
    document.getElementById('active-rule-title').textContent = calc.activeRule;
    document.getElementById('active-rule-desc').textContent = calc.ruleDescription;
  }

  // Highlight Option Buttons
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
    btn.classList.toggle('active', !isWet && ((state.edgingProfile === 'none' && btn.dataset.sides === 'none') || (state.edgingProfile !== 'none' && state.edgingSides === btn.dataset.sides)));
    btn.classList.toggle('dimmed', !isWet && state.edgingProfile === 'none' && btn.dataset.sides !== 'none');
  });

  // Region and Margins
  document.querySelectorAll('[data-region]').forEach(btn => btn.classList.toggle('active', state.region === btn.dataset.region));
  document.getElementById('bracket-select').value = state.bracket;

  const costFactorBox = document.getElementById('cost-factor-box');
  if (costFactorBox) {
    costFactorBox.classList.toggle('hidden', !state.isAdmin);
    document.getElementById('cost-factor-display').textContent = `Cost Basis: ${(calc.costPercentage * 100).toFixed(0)}%`;
  }

  // Draw Blueprint
  renderBlueprint(calc);

  // Financial Outputs
  const matMetricsView = document.getElementById('material-metrics-view');
  const costBreakdownView = document.getElementById('cost-breakdown-view');
  const lockedNotice = document.getElementById('cost-breakdown-locked-notice');

  if (!state.isAdmin) {
    document.getElementById('summary-title').textContent = '6. Specifications & Commercial Valuation';
    document.getElementById('summary-badge').textContent = 'Commercial Offer';
    matMetricsView.classList.remove('hidden');
    costBreakdownView.classList.add('hidden');
    if (lockedNotice) lockedNotice.classList.remove('hidden');
  } else {
    document.getElementById('summary-title').textContent = 'Itemized Cost Breakdown';
    document.getElementById('summary-badge').textContent = `${state.region} / ${state.bracket}`;
    matMetricsView.classList.add('hidden');
    costBreakdownView.classList.remove('hidden');
    if (lockedNotice) lockedNotice.classList.add('hidden');
  }

  document.getElementById('mat-usage-dimensions').textContent = isWet ? `3.0 ft x ${calc.roundedLength}.0 ft` : `${calc.width.toFixed(1)} ft x ${calc.length.toFixed(1)} ft`;
  document.getElementById('mat-usage-subtext').textContent = isWet ? `Charged 3.0 ft x ${calc.roundedLength}.0 ft standard cut` : `${calc.cols} x ${calc.rows} panel segments`;
  document.getElementById('adhesive-usage-length').textContent = `${calc.adhesiveLengthWithWaste.toFixed(1)} ln. ft.`;
  document.getElementById('edging-usage-length').textContent = calc.edgingProfile === 'none' || calc.edgingSides === 'none' || isWet ? 'No Edging Applied' : `${calc.edgingLength.toFixed(1)} ln. ft.`;

  // Itemized Two-Part Costs
  const detail = getDetailedCostStrings(calc, spec);
  const costValues = [
    { el: 'cost-val-matting', sub: 'cost-sub-matting', val: calc.mattingCost, text: detail.mattingSub },
    { el: 'cost-val-adhesive', sub: 'cost-sub-adhesive', val: calc.seamAdhesiveCost, text: detail.seamSub },
    { el: 'cost-val-edging', sub: 'cost-sub-edging', val: calc.edgingCost, text: detail.edgingSub },
    { el: 'cost-val-edging-adhesive', sub: 'cost-sub-edging-adhesive', val: calc.edgingAdhesiveCost, text: detail.edgingAdhesiveSub },
    { el: 'cost-val-labor', sub: 'cost-sub-labor', val: calc.laborCost, text: 'Standard fabrication, cutting & assembly fee @ \u20B1100.00 / order' },
    { el: 'cost-val-total', sub: 'cost-sub-total', val: calc.totalCost, text: 'Sum of master roll, adhesives, edging & fixed labor' }
  ];
  costValues.forEach(c => {
    const e = document.getElementById(c.el), s = document.getElementById(c.sub);
    if (e) e.textContent = formatPHP(c.val);
    if (s) s.textContent = c.text;
  });

  // Prominent Side-by-Side Selling Price Display (VAT EX | VAT INC)
  document.getElementById('price-excl-vat').textContent = formatPHP(calc.sellingPriceExclVat);
  document.getElementById('price-vat').textContent = formatPHP(calc.vatAmount);
  document.getElementById('price-inc-vat').textContent = calc.isValid ? formatPHP(calc.finalSellingPrice) : '₱0.00';
}

function resetCalculator() {
  Object.assign(state, DEFAULT_STATE);
  applyAutoDetection();
  document.getElementById('width-number-input').value = state.width;
  document.getElementById('width-range-input').value = state.width;
  document.getElementById('length-number-input').value = state.length;
  document.getElementById('length-range-input').value = state.length;
  document.getElementById('bracket-select').value = state.bracket;
  updateUI();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Intercept manual override interactions with confirmation pop-up modal
function handleAccessoryOverride(type, value) {
  const autoSettings = getAutoSettings(state.matType, state.width, state.length);
  let isOverride = false;

  if (type === 'adhesive' && value !== autoSettings.useAdhesive) isOverride = true;
  if (type === 'profile' && value !== autoSettings.edgingProfile) isOverride = true;
  if (type === 'sides' && value !== autoSettings.edgingSides) isOverride = true;

  if (isOverride) {
    pendingOverrideAction = () => {
      if (type === 'adhesive') {
        state.useAdhesive = value;
        state.isAdhesiveOverridden = true;
      }
      if (type === 'profile') {
        state.edgingProfile = value;
        state.isEdgingProfileOverridden = true;
        if (value === 'none') {
          state.edgingSides = 'none';
          state.isEdgingSidesOverridden = true;
        } else if (state.edgingSides === 'none') {
          state.edgingSides = 'four_sides';
          state.isEdgingSidesOverridden = true;
        }
      }
      if (type === 'sides') {
        state.edgingSides = value;
        state.isEdgingSidesOverridden = true;
        if (value === 'none') {
          state.edgingProfile = 'none';
          state.isEdgingProfileOverridden = true;
        } else if (state.edgingProfile === 'none') {
          state.edgingProfile = 'low_profile';
          state.isEdgingProfileOverridden = true;
        }
      }
      updateUI();
      document.getElementById('override-confirm-modal').classList.add('hidden');
    };
    document.getElementById('override-confirm-modal').classList.remove('hidden');
  } else {
    // Value matches auto-detected default setting, apply without warning prompt
    if (type === 'adhesive') {
      state.useAdhesive = value;
      state.isAdhesiveOverridden = false;
    }
    if (type === 'profile') {
      state.edgingProfile = value;
      state.isEdgingProfileOverridden = false;
    }
    if (type === 'sides') {
      state.edgingSides = value;
      state.isEdgingSidesOverridden = false;
    }
    updateUI();
  }
}

// 8. Bootstrap & Event Handlers
document.addEventListener('DOMContentLoaded', () => {
  const wNum = document.getElementById('width-number-input');
  const wRange = document.getElementById('width-range-input');
  const lNum = document.getElementById('length-number-input');
  const lRange = document.getElementById('length-range-input');

  const onDimensionChange = (val, type) => {
    state[type] = parseFloat(val) || 0;
    if (type === 'width') { wRange.value = state.width; wNum.value = state.width; }
    if (type === 'length') { lRange.value = state.length; lNum.value = state.length; }
    
    // Dimension changes re-trigger auto-detection for non-overridden controls
    applyAutoDetection();
    updateUI();
  };

  wNum.addEventListener('input', e => onDimensionChange(e.target.value, 'width'));
  wRange.addEventListener('input', e => onDimensionChange(e.target.value, 'width'));
  lNum.addEventListener('input', e => onDimensionChange(e.target.value, 'length'));
  lRange.addEventListener('input', e => onDimensionChange(e.target.value, 'length'));

  // Custom Accessory Options (with Manual Override Confirmation)
  document.querySelectorAll('[data-adhesive]').forEach(btn => {
    btn.addEventListener('click', () => handleAccessoryOverride('adhesive', btn.dataset.adhesive === 'true'));
  });
  document.querySelectorAll('[data-type]').forEach(btn => {
    btn.addEventListener('click', () => handleAccessoryOverride('profile', btn.dataset.type));
  });
  document.querySelectorAll('[data-sides]').forEach(btn => {
    btn.addEventListener('click', () => handleAccessoryOverride('sides', btn.dataset.sides));
  });

  // Pricing Modifiers
  document.querySelectorAll('[data-region]').forEach(btn => {
    btn.addEventListener('click', () => { state.region = btn.dataset.region; updateUI(); });
  });
  document.getElementById('bracket-select').addEventListener('change', e => {
    state.bracket = e.target.value; updateUI();
  });

  const resetBtn = document.getElementById('btn-reset-calculator');
  if (resetBtn) resetBtn.addEventListener('click', resetCalculator);

  // Administrative Access & Modals
  const adminAuthToggleBtn = document.getElementById('admin-auth-toggle-btn');
  if (adminAuthToggleBtn) {
    adminAuthToggleBtn.addEventListener('click', () => {
      if (state.isAdmin) { state.isAdmin = false; updateUI(); }
      else requestAdminAccess(null, 'Enter master administrator password ("grb123") to unlock privileged features.');
    });
  }

  document.getElementById('btn-open-rules').addEventListener('click', () => {
    document.getElementById('rules-modal').classList.remove('hidden');
  });
  const footerRulesBtn = document.getElementById('footer-rules-btn');
  if (footerRulesBtn) {
    footerRulesBtn.addEventListener('click', () => document.getElementById('rules-modal').classList.remove('hidden'));
  }

  document.getElementById('btn-open-cost-breakdown').addEventListener('click', () => requestAdminAccess(openCostBreakdownModal));
  const lockedNoticeBtn = document.getElementById('cost-breakdown-locked-notice');
  if (lockedNoticeBtn) lockedNoticeBtn.addEventListener('click', () => requestAdminAccess(openCostBreakdownModal));

  document.getElementById('admin-password-form').addEventListener('submit', e => { e.preventDefault(); verifyAdminPassword(); });
  document.getElementById('btn-submit-password').addEventListener('click', verifyAdminPassword);
  
  ['btn-cancel-password', 'btn-close-password-modal'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => document.getElementById('password-prompt-modal').classList.add('hidden'));
  });

  // Cost Breakdown Modal Populator
  function openCostBreakdownModal() {
    const calc = calculateOrder(state);
    const spec = MAT_SPECS[calc.matType];
    const detail = getDetailedCostStrings(calc, spec);

    document.getElementById('modal-cost-matting').textContent = formatPHP(calc.mattingCost);
    document.getElementById('modal-cost-sub-matting').textContent = detail.mattingSub;
    document.getElementById('modal-cost-seam-adhesive').textContent = formatPHP(calc.seamAdhesiveCost);
    document.getElementById('modal-cost-sub-seam-adhesive').textContent = detail.seamSub;
    document.getElementById('modal-cost-edging').textContent = formatPHP(calc.edgingCost);
    document.getElementById('modal-cost-sub-edging').textContent = detail.edgingSub;
    document.getElementById('modal-cost-edging-adhesive').textContent = formatPHP(calc.edgingAdhesiveCost);
    document.getElementById('modal-cost-sub-edging-adhesive').textContent = detail.edgingAdhesiveSub;
    document.getElementById('modal-cost-labor').textContent = formatPHP(calc.laborCost);
    
    // Two-Part Engine Multipliers
    document.getElementById('modal-cost-part1').textContent = formatPHP(calc.part1DirectCost);
    document.getElementById('modal-cost-part2').textContent = formatPHP(calc.part2DirectCost);
    
    document.getElementById('modal-cost-bracket').textContent = `${state.region} - ${state.bracket}`;
    document.getElementById('modal-cost-basis').textContent = `${(calc.costPercentage * 100).toFixed(0)}%`;
    
    document.getElementById('modal-cost-excl-vat').textContent = formatPHP(calc.sellingPriceExclVat);
    document.getElementById('modal-cost-vat').textContent = formatPHP(calc.vatAmount);
    document.getElementById('modal-cost-inc-vat').textContent = formatPHP(calc.finalSellingPrice);
    
    document.getElementById('cost-breakdown-modal').classList.remove('hidden');
  }

  ['btn-close-cost-breakdown-modal', 'btn-close-cost-breakdown-footer'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => document.getElementById('cost-breakdown-modal').classList.add('hidden'));
  });
  
  ['btn-close-rules-modal', 'btn-rules-footer-close'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => document.getElementById('rules-modal').classList.add('hidden'));
  });

  // Override Modal Actions
  document.getElementById('btn-confirm-override').addEventListener('click', () => {
    if (typeof pendingOverrideAction === 'function') pendingOverrideAction();
    pendingOverrideAction = null;
  });
  ['btn-cancel-override', 'btn-close-override-modal'].forEach(id => {
    document.getElementById(id).addEventListener('click', () => {
      document.getElementById('override-confirm-modal').classList.add('hidden');
      pendingOverrideAction = null;
    });
  });

  function requestAdminAccess(onSuccess, promptMsg) {
    if (state.isAdmin) {
      if (typeof onSuccess === 'function') onSuccess();
      return;
    }
    pendingAdminAction = onSuccess;
    const desc = document.getElementById('password-prompt-description');
    if (promptMsg && desc) desc.textContent = promptMsg;
    
    document.getElementById('admin-password-input').value = '';
    document.getElementById('admin-password-error').classList.add('hidden');
    document.getElementById('password-prompt-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('admin-password-input').focus(), 60);
  }

  function verifyAdminPassword() {
    const input = document.getElementById('admin-password-input');
    if ((input.value || '').trim() === ADMIN_PASSWORD) {
      state.isAdmin = true;
      document.getElementById('password-prompt-modal').classList.add('hidden');
      updateUI();
      if (typeof pendingAdminAction === 'function') pendingAdminAction();
      pendingAdminAction = null;
    } else {
      document.getElementById('admin-password-error').classList.remove('hidden');
      input.classList.add('input-error', 'shake');
      setTimeout(() => input.classList.remove('shake'), 400);
      input.focus();
    }
  }

  // Initial load and calculation synchronization
  applyAutoDetection();
  updateUI();
});
