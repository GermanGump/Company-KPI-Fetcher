import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

// Main App Component
const App = () => {
  const [companyName, setCompanyName] = useState('');
  const [ticker, setTicker] = useState('');
  const [startQuarter, setStartQuarter] = useState('Q1');
  const [startYear, setStartYear] = useState('2020');
  const [endQuarter, setEndQuarter] = useState('Q1');
  const [endYear, setEndYear] = useState('2025');

  const [rawQuarterlyData, setRawQuarterlyData] = useState([]); // This will now store data processed from Gemini
  const [revenueTTMChartData, setRevenueTTMChartData] = useState([]);
  const [fcfTTMChartData, setFcfTTMChartData] = useState([]);
  const [epsTTMChartData, setEpsTTMChartData] = useState([]);
  const [netIncomeTTMChartData, setNetIncomeTTMChartData] = useState([]);
  const [isFetchingData, setIsFetchingData] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [verificationWarning, setVerificationWarning] = useState(null);

  // State for Debug Panel
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [rawIncomeStatement, setRawIncomeStatement] = useState(null);
  const [rawCashFlow, setRawCashFlow] = useState(null);
  const [rawEarnings, setRawEarnings] = useState(null);

  // Calculated CAGR/Growth rates
  const [calculatedCagrs, setCalculatedCagrs] = useState({
    revenue1Yr: null, revenue2Yr: null, revenue4Yr: null,
    eps1Yr: null, eps2Yr: null, eps4Yr: null,
    fcf1Yr: null, fcf2Yr: null, fcf4Yr: null,
    netIncome1Yr: null, netIncome2Yr: null, netIncome4Yr: null,
  });

  // Helper function to calculate Compound Annual Growth Rate (CAGR)
  const calculateCAGR = (endValue, startValue, years) => {
    console.log(`[calculateCAGR] Inputs: endValue=${endValue}, startValue=${startValue}, years=${years}`);

    if (startValue === null || endValue === null || years <= 0 || isNaN(years)) {
        console.log(`[calculateCAGR] Returning null due to invalid inputs (null values or years <= 0).`);
        return null;
    }
    if (isNaN(startValue) || isNaN(endValue)) {
        // This check is important if getQuarterDataPoint returns NaN instead of null/0 for missing data.
        // Currently, it returns 0 for missing points, so this might not be hit often unless raw data contains NaN.
        console.log(`[calculateCAGR] Returning null due to NaN startValue or endValue.`);
        return null;
    }

    // Handle cases involving zero for startValue
    if (startValue === 0) {
        if (endValue > 0) {
            console.log(`[calculateCAGR] startValue is 0, endValue is positive. Returning Infinity.`);
            return Infinity;
        }
        if (endValue < 0) {
            console.log(`[calculateCAGR] startValue is 0, endValue is negative. Returning -Infinity.`);
            return -Infinity; // Growth from 0 to negative is infinitely bad / large decline
        }
        if (endValue === 0) {
            console.log(`[calculateCAGR] Both startValue and endValue are 0. Returning 0 (no change).`);
            return 0; // No change
        }
    }

    // Handle cases involving zero for endValue (startValue is non-zero here)
    if (endValue === 0) {
        if (startValue > 0) {
            console.log(`[calculateCAGR] endValue is 0, startValue is positive. Returning -1 (100% decline).`);
            return -1; // 100% decline
        }
        // if startValue < 0 and endValue is 0 (e.g. -100 to 0)
        console.log(`[calculateCAGR] endValue is 0, startValue is negative. Returning 1 (100% growth).`);
        return 1; // Represents 100% growth (e.g., loss eliminated)
    }

    // Handle cases with negative values if not crossing zero (both start and end are non-zero here)
    if (startValue < 0 && endValue < 0) {
        let result;
        // If magnitude of startValue is greater than magnitude of endValue (e.g., -100 to -50, less negative = growth)
        if (Math.abs(startValue) > Math.abs(endValue)) {
            result = ( (Math.abs(startValue) / Math.abs(endValue)) ** (1 / years) ) - 1;
        }
        // If magnitude of startValue is less than magnitude of endValue (e.g., -50 to -100, more negative = decline)
        else if (Math.abs(startValue) < Math.abs(endValue)) {
            result = -( ( (Math.abs(endValue) / Math.abs(startValue)) ** (1 / years) ) - 1 );
        }
        // Magnitudes are equal (e.g., -100 to -100)
        else {
            result = 0; // No change
        }
        console.log(`[calculateCAGR] Both negative (non-zero). startValue=${startValue}, endValue=${endValue}. Result=${result}`);
        return result;
    }

    // Handle swings across zero (both start and end are non-zero here)
    if (startValue < 0 && endValue > 0) { // From negative to positive (clear growth)
        console.log(`[calculateCAGR] Negative to positive (non-zero). Returning Infinity.`);
        return Infinity;
    }
    if (startValue > 0 && endValue < 0) { // From positive to negative (clear decline)
        console.log(`[calculateCAGR] Positive to negative (non-zero). Returning -Infinity (representing large decline).`);
        return -Infinity;
    }

    // Default case: both positive and non-zero
    if (startValue > 0 && endValue > 0) {
        const result = (endValue / startValue) ** (1 / years) - 1;
        console.log(`[calculateCAGR] Standard calculation (both positive, non-zero). Result=${result}`);
        return result;
    }

    // Fallback or unexpected case
    console.warn(`[calculateCAGR] Unhandled case: endValue=${endValue}, startValue=${startValue}, years=${years}. Returning null.`);
    return null;
  };

  // Helper function to convert "Qx YYYY" to "YYYY-MM" for consistent sorting and matching
  const convertQuarterToMonth = (quarterStr) => {
    if (!quarterStr) return null;
    const [q, year] = quarterStr.split(' ');
    const yearNum = parseInt(year);
    const quarterNum = parseInt(q.replace('Q', ''));
    let monthNum;
    switch (quarterNum) {
      case 1: monthNum = '03'; break; // Q1 ends March
      case 2: monthNum = '06'; break; // Q2 ends June
      case 3: monthNum = '09'; break; // Q3 ends September
      case 4: monthNum = '12'; break; // Q4 ends December
      default: return null;
    }
    return `${yearNum}-${monthNum}`;
  };

  // Effect to process raw data into chart-specific data formats for rendering
  useEffect(() => {
    if (rawQuarterlyData.length === 0) {
      setRevenueTTMChartData([]);
      setFcfTTMChartData([]);
      setEpsTTMChartData([]);
      setNetIncomeTTMChartData([]);
      return;
    }

    // Sort rawQuarterlyData chronologically first, as Gemini might not always return it sorted.
    // Use a custom sort based on the converted month string.
    try {
    console.log("[TTM Effect] Processing rawQuarterlyData:", rawQuarterlyData);
    const sortedRawData = [...rawQuarterlyData].sort((a, b) => {
      const dateA = convertQuarterToMonth(a.quarter);
      const dateB = convertQuarterToMonth(b.quarter);
      if (dateA < dateB) return -1;
      if (dateA > dateB) return 1;
      return 0;
    });

    const ttmRevenueData = [];
    const ttmFcfData = [];
    const ttmEpsData = [];
    const ttmNetIncomeData = [];

    // Process TTM calculations for the filtered range
    // We need at least 4 quarters *before* the first quarter to display a TTM value.
    const fullDataRange = sortedRawData;

    for (let i = 0; i < fullDataRange.length; i++) {
      const currentQuarterObj = fullDataRange[i];
      const currentQuarterDisplay = currentQuarterObj.quarter; // e.g., "Q1 2025"
      const currentQuarterSortable = convertQuarterToMonth(currentQuarterDisplay); // e.g., "2025-03"

      // Convert user-defined start and end quarters to sortable month strings for filtering
      const startMonth = convertQuarterToMonth(`${startQuarter} ${startYear}`);
      const endMonth = convertQuarterToMonth(`${endQuarter} ${endYear}`);

      // Only add to display data if it falls within the user-defined range and we have enough history for TTM
      if (currentQuarterSortable >= startMonth && currentQuarterSortable <= endMonth) {
        console.log(`[TTM Effect] Current quarter: ${currentQuarterDisplay} (Sortable: ${currentQuarterSortable}) is within user range [${startMonth} - ${endMonth}]`);
        // Ensure enough preceding quarters for TTM calculation
        if (i >= 3) {
          const ttmWindowData = fullDataRange.slice(i - 3, i + 1);
          console.log(`[TTM Effect]   TTM window for ${currentQuarterDisplay}:`, ttmWindowData.map(d => ({ q: d.quarter, rev: d.productRevenueM, fcf: d.fcfM, eps: d.eps, ni: d.netIncomeM })));

          // TTM Revenue (sum of product and service revenue)
          const totalRevenueTTMSum = ttmWindowData.reduce((sum, q) => sum + (q.productRevenueM || 0) + (q.serviceRevenueM || 0), 0);
          const totalRevenueTTM = totalRevenueTTMSum / 1_000_000_000; // Convert to Billions for chart
          console.log(`[TTM Effect]     Revenue TTM for ${currentQuarterDisplay}: Sum=${totalRevenueTTMSum}, ChartValue (B)=${totalRevenueTTM}`);
          ttmRevenueData.push({
            Quarter: currentQuarterDisplay,
            'Total Revenue B': parseFloat(totalRevenueTTM.toFixed(2)),
          });

          // TTM Free Cash Flow
          const fcfTTMSum = ttmWindowData.reduce((sum, q) => sum + (q.fcfM || 0), 0);
          const fcfTTM = fcfTTMSum / 1_000_000_000; // Convert to Billions for chart
          console.log(`[TTM Effect]     FCF TTM for ${currentQuarterDisplay}: Sum=${fcfTTMSum}, ChartValue (B)=${fcfTTM}`);
          ttmFcfData.push({
            Quarter: currentQuarterDisplay,
            'TTM FCF B': parseFloat(fcfTTM.toFixed(2)),
          });

          // TTM Earnings Per Share
          const epsTTMSum = ttmWindowData.reduce((sum, q) => sum + (q.eps || 0), 0);
          // EPS is not divided by billions, it's a per-share value.
          console.log(`[TTM Effect]     EPS TTM for ${currentQuarterDisplay}: Sum=${epsTTMSum}`);
          ttmEpsData.push({
            Quarter: currentQuarterDisplay,
            'TTM EPS': parseFloat(epsTTMSum.toFixed(2)),
          });

          // TTM Net Income
          // Net Income is kept in Millions for the chart as per 'Net Income M'
          const netIncomeTTMSum = ttmWindowData.reduce((sum, q) => sum + (q.netIncomeM || 0), 0);
          console.log(`[TTM Effect]     Net Income TTM for ${currentQuarterDisplay}: Sum (M)=${netIncomeTTMSum}`);
          ttmNetIncomeData.push({
            Quarter: currentQuarterDisplay,
            'Net Income M': parseFloat(netIncomeTTMSum.toFixed(2)), // Already in Millions from rawQuarterlyData
          });
        } else {
          console.log(`[TTM Effect]   Skipping TTM for ${currentQuarterDisplay} (index ${i}), not enough historical data (needs i >= 3).`);
        }
      } else {
        // console.log(`[TTM Effect] Current quarter: ${currentQuarterDisplay} (Sortable: ${currentQuarterSortable}) is OUTSIDE user range [${startMonth} - ${endMonth}]`);
      }
    }

    console.log("[TTM Effect] Final TTM Data for Charts:", { ttmRevenueData, ttmFcfData, ttmEpsData, ttmNetIncomeData });
    setRevenueTTMChartData(ttmRevenueData);
    setFcfTTMChartData(ttmFcfData);
    setEpsTTMChartData(ttmEpsData);
    setNetIncomeTTMChartData(ttmNetIncomeData);
    } catch (error) {
      console.error("Error processing TTM data:", error);
      /* setFetchError("An error occurred while processing financial data."); */
    }

  }, [rawQuarterlyData, startQuarter, startYear, endQuarter, endYear]);

  // Effect to calculate CAGRs dynamically based on data
  useEffect(() => {
    if (revenueTTMChartData.length === 0 || fcfTTMChartData.length === 0 ||
        epsTTMChartData.length === 0 || netIncomeTTMChartData.length === 0) {
      setCalculatedCagrs({
        revenue1Yr: null, revenue2Yr: null, revenue4Yr: null,
        eps1Yr: null, eps2Yr: null, eps4Yr: null,
        fcf1Yr: null, fcf2Yr: null, fcf4Yr: null,
        netIncome1Yr: null, netIncome2Yr: null, netIncome4Yr: null,
      });
      return;
    }

    // Helper to get data point for a specific quarter, assuming data is sorted by quarter
  try {
    const getQuarterDataPoint = (data, targetQuarter, key) => {
        const found = data.find(d => d.Quarter === targetQuarter);
        return found ? found[key] : 0;
    };

    // Function to get a quarter string N years ago relative to a given quarter string (e.g. Q1 2025 -> Q1 2024)
    const getRelativeQuarter = (baseQuarterStr, yearsAgo) => {
      if (!baseQuarterStr) return null;
      // Extract year and quarter number (Q1, Q2, Q3, Q4)
      const [q, year] = baseQuarterStr.split(' ');
      const yearNum = parseInt(year);
      const targetYear = yearNum - yearsAgo;
      return `${q} ${targetYear}`;
    };

    // Get the latest quarter available in the *chart data*
    const latestQuarterInChart = revenueTTMChartData[revenueTTMChartData.length - 1]?.Quarter;
    console.log(`[CAGR Effect] Latest quarter in chart data: ${latestQuarterInChart}`);
    if (!latestQuarterInChart) {
        console.log("[CAGR Effect] No chart data available, CAGRs will be null.");
        // setCalculatedCagrs to initial state (all nulls) is already handled at the start of useEffect.
        return;
    }

    // Helper to log and get data point more carefully
    const getLoggedQuarterDataPoint = (data, targetQuarter, key) => {
        // First, ensure targetQuarter is valid, as getRelativeQuarter might have returned null
        if (!targetQuarter) {
            console.log(`[CAGR Effect] getQuarterDataPoint: targetQuarter is null/undefined for key='${key}'. Returning 0 as per original getQuarterDataPoint behavior for missing data.`);
            return 0; // Consistent with original getQuarterDataPoint's behavior for missing entries.
        }
        const value = getQuarterDataPoint(data, targetQuarter, key); // Assumes getQuarterDataPoint handles not found by returning 0 or null
        console.log(`[CAGR Effect] getQuarterDataPoint: data_length=${data.length}, targetQuarter='${targetQuarter}', key='${key}', value=${value}`);
        return value;
    };

    const getLoggedRelativeQuarter = (baseQuarterStr, yearsAgo) => {
        const value = getRelativeQuarter(baseQuarterStr, yearsAgo);
        console.log(`[CAGR Effect] getRelativeQuarter: baseQuarter='${baseQuarterStr}', yearsAgo=${yearsAgo}, result='${value}'`);
        return value;
    };

    // Revenue TTM CAGR Calculation
    const latestRevenueTTM = getLoggedQuarterDataPoint(revenueTTMChartData, latestQuarterInChart, 'Total Revenue B');
    const revenue1YrAgo = getLoggedQuarterDataPoint(revenueTTMChartData, getLoggedRelativeQuarter(latestQuarterInChart, 1), 'Total Revenue B');
    const revenue2YrAgo = getLoggedQuarterDataPoint(revenueTTMChartData, getLoggedRelativeQuarter(latestQuarterInChart, 2), 'Total Revenue B');
    const revenue4YrAgo = getLoggedQuarterDataPoint(revenueTTMChartData, getLoggedRelativeQuarter(latestQuarterInChart, 4), 'Total Revenue B');

    console.log("[CAGR Effect] Revenue TTM values for CAGR:", { latestRevenueTTM, revenue1YrAgo, revenue2YrAgo, revenue4YrAgo });
    const cagrRevenue1Yr = calculateCAGR(latestRevenueTTM, revenue1YrAgo, 1);
    const cagrRevenue2Yr = calculateCAGR(latestRevenueTTM, revenue2YrAgo, 2);
    const cagrRevenue4Yr = calculateCAGR(latestRevenueTTM, revenue4YrAgo, 4);

    // EPS TTM CAGR Calculation
    const latestEpsTTM = getLoggedQuarterDataPoint(epsTTMChartData, latestQuarterInChart, 'TTM EPS');
    const eps1YrAgo = getLoggedQuarterDataPoint(epsTTMChartData, getLoggedRelativeQuarter(latestQuarterInChart, 1), 'TTM EPS');
    const eps2YrAgo = getLoggedQuarterDataPoint(epsTTMChartData, getLoggedRelativeQuarter(latestQuarterInChart, 2), 'TTM EPS');
    const eps4YrAgo = getLoggedQuarterDataPoint(epsTTMChartData, getLoggedRelativeQuarter(latestQuarterInChart, 4), 'TTM EPS');

    console.log("[CAGR Effect] EPS TTM values for CAGR:", { latestEpsTTM, eps1YrAgo, eps2YrAgo, eps4YrAgo });
    const cagrEps1Yr = calculateCAGR(latestEpsTTM, eps1YrAgo, 1);
    const cagrEps2Yr = calculateCAGR(latestEpsTTM, eps2YrAgo, 2);
    const cagrEps4Yr = calculateCAGR(latestEpsTTM, eps4YrAgo, 4);

    // FCF TTM CAGR Calculation
    const latestFcfTTM = getLoggedQuarterDataPoint(fcfTTMChartData, latestQuarterInChart, 'TTM FCF B');
    const fcf1YrAgo = getLoggedQuarterDataPoint(fcfTTMChartData, getLoggedRelativeQuarter(latestQuarterInChart, 1), 'TTM FCF B');
    const fcf2YrAgo = getLoggedQuarterDataPoint(fcfTTMChartData, getLoggedRelativeQuarter(latestQuarterInChart, 2), 'TTM FCF B');
    const fcf4YrAgo = getLoggedQuarterDataPoint(fcfTTMChartData, getLoggedRelativeQuarter(latestQuarterInChart, 4), 'TTM FCF B');

    console.log("[CAGR Effect] FCF TTM values for CAGR:", { latestFcfTTM, fcf1YrAgo, fcf2YrAgo, fcf4YrAgo });
    const cagrFcf1Yr = calculateCAGR(latestFcfTTM, fcf1YrAgo, 1);
    const cagrFcf2Yr = calculateCAGR(latestFcfTTM, fcf2YrAgo, 2);
    const cagrFcf4Yr = calculateCAGR(latestFcfTTM, fcf4YrAgo, 4);

    // Net Income TTM CAGR Calculation
    const latestNetIncomeTTM = getLoggedQuarterDataPoint(netIncomeTTMChartData, latestQuarterInChart, 'Net Income M');
    const netIncome1YrAgo = getLoggedQuarterDataPoint(netIncomeTTMChartData, getLoggedRelativeQuarter(latestQuarterInChart, 1), 'Net Income M');
    const netIncome2YrAgo = getLoggedQuarterDataPoint(netIncomeTTMChartData, getLoggedRelativeQuarter(latestQuarterInChart, 2), 'Net Income M');
    const netIncome4YrAgo = getLoggedQuarterDataPoint(netIncomeTTMChartData, getLoggedRelativeQuarter(latestQuarterInChart, 4), 'Net Income M');

    console.log("[CAGR Effect] Net Income TTM values for CAGR:", { latestNetIncomeTTM, netIncome1YrAgo, netIncome2YrAgo, netIncome4YrAgo });
    const cagrNetIncome1Yr = calculateCAGR(latestNetIncomeTTM, netIncome1YrAgo, 1);
    const cagrNetIncome2Yr = calculateCAGR(latestNetIncomeTTM, netIncome2YrAgo, 2);
    const cagrNetIncome4Yr = calculateCAGR(latestNetIncomeTTM, netIncome4YrAgo, 4);

    const finalCagrs = {
      revenue1Yr: cagrRevenue1Yr, revenue2Yr: cagrRevenue2Yr, revenue4Yr: cagrRevenue4Yr,
      eps1Yr: cagrEps1Yr, eps2Yr: cagrEps2Yr, eps4Yr: cagrEps4Yr,
      fcf1Yr: cagrFcf1Yr, fcf2Yr: cagrFcf2Yr, fcf4Yr: cagrFcf4Yr,
      netIncome1Yr: cagrNetIncome1Yr, netIncome2Yr: cagrNetIncome2Yr, netIncome4Yr: cagrNetIncome4Yr,
    };
    console.log("[CAGR Effect] Final Calculated CAGRs:", finalCagrs);
    setCalculatedCagrs(finalCagrs);

    } catch (error) {
      console.error("[CAGR Effect] Error calculating CAGRs:", error);
      /* setCalculatedCagrs({...initialCagrs, error: "Failed to calculate CAGRs"}); */
    }
  }, [revenueTTMChartData, fcfTTMChartData, epsTTMChartData, netIncomeTTMChartData]);


  /**
   * Fetches KPI data from Gemini API based on user-defined date range.
   */
  const fetchKpiData = async () => {
    if (!companyName || !ticker || !startQuarter || !startYear || !endQuarter || !endYear) {
      setFetchError("Please fill in all company and date range fields.");
      setTimeout(() => setFetchError(null), 3000);
      return;
    }

    // Validate date range before API call
    const startMonth = convertQuarterToMonth(`${startQuarter} ${startYear}`);
    const endMonth = convertQuarterToMonth(`${endQuarter} ${endYear}`);

    if (startMonth > endMonth) {
      setFetchError("Start date cannot be after end date.");
      setTimeout(() => setFetchError(null), 3000);
      return;
    }

    setIsFetchingData(true);
    setFetchError(null);
    setVerificationWarning(null);
    setRawQuarterlyData([]); // Clear previous data
    setRawIncomeStatement(null);
    setRawCashFlow(null);
    setRawEarnings(null);

    let apiKey = process.env.REACT_APP_ALPHA_VANTAGE_API_KEY;

    const maskedApiKey = apiKey ? `${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 2)}` : "Not Set";
    console.log(`[fetchKpiData] Initiating fetch for Ticker: ${ticker}. API Key: ${apiKey === 'demo' ? 'demo' : maskedApiKey}. Start: ${startQuarter}${startYear}, End: ${endQuarter}${endYear}`);

    if (!apiKey) {
      setFetchError("Alpha Vantage API key not configured. Using 'demo' key, which has limitations. Please set your REACT_APP_ALPHA_VANTAGE_API_KEY for full functionality.");
      apiKey = 'demo'; // Use "demo" key if actual key is not found
    }

    const baseUrl = `https://www.alphavantage.co/query`;

    // Helper function to parse Alpha Vantage numbers, converting "None" or invalid to null
    const parseAlphaVantageNumber = (value) => {
        if (value === "None" || value === undefined || value === null || value === '' || typeof value === 'object') return null; // typeof object check for safety
        const num = parseFloat(value);
        return isNaN(num) ? null : num;
    };

    // Helper function to map fiscal date to quarter string
    const mapFiscalDateToQuarter = (fiscalDate) => {
        if (!fiscalDate || typeof fiscalDate !== 'string') return null;
        const date = new Date(fiscalDate);
        const year = date.getUTCFullYear(); // Use UTC to avoid timezone issues
        const month = date.getUTCMonth() + 1; // getUTCMonth() is 0-indexed
        let quarterNum;
        if (month <= 3) quarterNum = 1;
        else if (month <= 6) quarterNum = 2;
        else if (month <= 9) quarterNum = 3;
        else quarterNum = 4;
        return `Q${quarterNum} ${year}`;
    };

    try {
      const functionsToFetch = [
        { name: 'INCOME_STATEMENT', stateSetter: setRawIncomeStatement, key: 'quarterlyReports' },
        { name: 'CASH_FLOW', stateSetter: setRawCashFlow, key: 'quarterlyReports' },
        { name: 'EARNINGS', stateSetter: setRawEarnings, key: 'quarterlyEarnings' },
      ];

      const apiData = {};
      let apiErrorOccurred = false;

      for (const func of functionsToFetch) {
        if (apiErrorOccurred && apiKey === 'demo') break; // Don't make more calls with demo key if one failed

        const apiUrl = `${baseUrl}?function=${func.name}&symbol=${ticker}&apikey=${apiKey}`;
        console.log(`[fetchKpiData] Fetching ${func.name} from URL: ${apiUrl.replace(apiKey, maskedApiKey)}`);
        try {
            const response = await fetch(apiUrl);
            if (!response.ok) {
              console.error(`[fetchKpiData] API error for ${func.name}: ${response.status} ${response.statusText}`);
              throw new Error(`Request failed for ${func.name} (${response.status}).`);
            }
            const data = await response.json();
            console.log(`[fetchKpiData] Raw response for ${func.name} (summary):`, { keys: Object.keys(data), note: data["Note"], info: data["Information"], errorMsg: data["Error Message"] });

            if (data["Note"] && data["Note"].includes("Thank you for using Alpha Vantage")) {
                // More specific rate limit message for "Note"
                apiErrorOccurred = true;
                const userMessage = `API rate limit likely reached for ${func.name} (using ${apiKey === 'demo' ? 'demo' : 'your'} key). Please wait and try again later, or check your Alpha Vantage plan. (API Note: ${data["Note"]})`;
                func.stateSetter({ error: userMessage, rawResponse: data });
                setFetchError(prev => (prev ? prev + "; " : "") + userMessage);
                if (apiKey === 'demo') break; else continue;
            }
            if (data["Information"] && data["Information"].includes("call frequency is")) {
                 apiErrorOccurred = true;
                 const userMessage = `API rate limit reached for ${func.name}. Please wait and try again. (API Info: ${data["Information"]})`;
                 func.stateSetter({ error: userMessage, rawResponse: data });
                 setFetchError(prev => (prev ? prev + "; " : "") + userMessage);
                 if (apiKey === 'demo') break; else continue;
            }
            if (data["Error Message"]) {
              apiErrorOccurred = true;
              const userMessage = `API error for ${func.name}: ${data["Error Message"]}. Check ticker or API key.`;
              func.stateSetter({ error: userMessage, rawResponse: data });
              setFetchError(prev => (prev ? prev + "; " : "") + userMessage);
              if (apiKey === 'demo') break; else continue;
            }
            if (Object.keys(data).length === 0 || !data[func.key] || data[func.key].length === 0 && !data['Global Quote']) {
              // Global Quote is for stock price, not financial statements, but an empty object is a common response for bad tickers.
              // If func.key (e.g. 'quarterlyReports') is empty or not present, it means no specific data.
              apiErrorOccurred = true;
              const userMessage = `No data returned from Alpha Vantage for ${func.name} and ticker ${ticker}. The ticker might be invalid, delisted, or data may not be available.`;
              func.stateSetter({ error: userMessage, rawResponse: data });
              // This might not be a "fetchError" if other endpoints succeed. It will be caught by data verification.
              // However, if all fail, it becomes a fetchError.
              console.warn(`[fetchKpiData] ${userMessage}`);
              // We don't setFetchError here directly, but let data verification handle partial data.
              // apiData[func.name] will remain empty or undefined.
            }
            func.stateSetter(data);
            apiData[func.name] = data[func.key] || [];
            console.log(`[fetchKpiData] Successfully fetched and stored raw data for ${func.name}. Found ${apiData[func.name]?.length || 0} reports.`);

        } catch (e) {
            apiErrorOccurred = true;
            console.error(`[fetchKpiData] Catch block error for ${func.name}:`, e);
            func.stateSetter({ error: e.message, rawResponse: { message: e.message } }); // Store error for debug
            const currentFetchError = fetchError ? fetchError + "; " : "";
            // Avoid duplicate messages if already set by specific checks above
            if (!fetchError || !fetchError.includes(e.message)) {
                 setFetchError(currentFetchError + `Failed to fetch ${func.name}: ${e.message}`);
            }
            if (apiKey === 'demo') {
                 setFetchError(prev => (prev ? prev + "; " : "") + `For 'demo' key, further API calls for this request aborted to conserve quota.`);
                 break;
            }
        }
      }

      if (apiErrorOccurred && apiKey === 'demo' && fetchError) {
          console.warn("[fetchKpiData] API error occurred with 'demo' key. Further processing halted early.");
          setIsFetchingData(false);
          return;
      }

      console.log("[fetchKpiData] Starting data parsing and combination...");
      // Process and combine data
      const combinedData = {};

      // Income Statement Data
      (apiData['INCOME_STATEMENT'] || []).forEach(report => {
        const quarter = mapFiscalDateToQuarter(report.fiscalDateEnding);
        if (!quarter) return;
        if (!combinedData[quarter]) combinedData[quarter] = { quarter };

        const totalRevenue = parseAlphaVantageNumber(report.totalRevenue);
        // Alpha Vantage values are absolute, convert to millions for consistency with 'M' suffix
        combinedData[quarter].productRevenueM = totalRevenue !== null ? totalRevenue / 1000000 : null;
        combinedData[quarter].serviceRevenueM = 0; // Assuming service revenue is not separately provided

        const netIncome = parseAlphaVantageNumber(report.netIncome);
        combinedData[quarter].netIncomeM = netIncome !== null ? netIncome / 1000000 : null;
      });

      // Cash Flow Data
      (apiData['CASH_FLOW'] || []).forEach(report => {
        const quarter = mapFiscalDateToQuarter(report.fiscalDateEnding);
        if (!quarter) return;
        if (!combinedData[quarter]) combinedData[quarter] = { quarter };

        const operatingCashflow = parseAlphaVantageNumber(report.operatingCashflow);
        const capitalExpenditures = parseAlphaVantageNumber(report.capitalExpenditures);

        if (operatingCashflow !== null && capitalExpenditures !== null) {
          combinedData[quarter].fcfM = (operatingCashflow - capitalExpenditures) / 1000000;
        } else {
          // Ensure fcfM is at least initialized to null if components are missing
          if (combinedData[quarter].fcfM === undefined) combinedData[quarter].fcfM = null;
        }
      });

      // Earnings Data
      (apiData['EARNINGS'] || []).forEach(report => {
        const quarter = mapFiscalDateToQuarter(report.fiscalDateEnding);
        if (!quarter) return;
        if (!combinedData[quarter]) combinedData[quarter] = { quarter };
        combinedData[quarter].eps = parseAlphaVantageNumber(report.reportedEPS);
      });

      const processedDataArray = Object.values(combinedData)
        .filter(q => q.quarter)
        .map(q => ({ // Ensure all required fields are present, defaulting to null
            quarter: q.quarter,
            productRevenueM: q.productRevenueM !== undefined ? q.productRevenueM : null,
            serviceRevenueM: q.serviceRevenueM !== undefined ? q.serviceRevenueM : 0, // Default to 0
            eps: q.eps !== undefined ? q.eps : null,
            fcfM: q.fcfM !== undefined ? q.fcfM : null,
            netIncomeM: q.netIncomeM !== undefined ? q.netIncomeM : null,
        }))
        .sort((a, b) => {
          const dateA = convertQuarterToMonth(a.quarter);
          const dateB = convertQuarterToMonth(b.quarter);
          if (dateA < dateB) return -1;
          if (dateA > dateB) return 1;
          return 0;
        });

      setRawQuarterlyData(processedDataArray);

      // Data Verification Logic
      let currentWarnings = [];
      if (apiKey === 'demo') {
          currentWarnings.push("Using 'demo' API key. Data may be limited/outdated. Set a valid key for full functionality.");
      }

      if (processedDataArray.length > 0) {
        const userStartMonth = convertQuarterToMonth(`${startQuarter} ${startYear}`);
        const userEndMonth = convertQuarterToMonth(`${endQuarter} ${endYear}`);

        const filteredForVerification = processedDataArray.filter(d => {
            if (!d.quarter) return false;
            const currentMonth = convertQuarterToMonth(d.quarter);
            return currentMonth >= userStartMonth && currentMonth <= userEndMonth;
        });

        let missingRevenue = 0;
        let missingEps = 0;
        let missingFcf = 0;
        let missingNetIncome = 0;
        let netIncomeGreaterThanRevenueCount = 0;
        let quartersInSelectedRange = 0;
        let validQuartersForCompleteness = 0;


        const expectedQuartersSet = new Set();
        if (userStartMonth && userEndMonth) {
            let currentIterMonth = userStartMonth;
            while(currentIterMonth <= userEndMonth) {
                const [yearStr, monthStr] = currentIterMonth.split('-');
                const year = parseInt(yearStr);
                const month = parseInt(monthStr);
                let q;
                if (month === 3) q = 'Q1'; else if (month === 6) q = 'Q2'; else if (month === 9) q = 'Q3'; else q = 'Q4';
                expectedQuartersSet.add(`${q} ${year}`);

                if (month === 12) currentIterMonth = `${year + 1}-03`;
                else {
                    const nextMonth = month + 3;
                    currentIterMonth = `${year}-${String(nextMonth).padStart(2, '0')}`;
                }
            }
        }
        const totalExpectedQuartersInRange = expectedQuartersSet.size;

        if (filteredForVerification.length < totalExpectedQuartersInRange && totalExpectedQuartersInRange > 0) {
            currentWarnings.push(`Selected date range expects ${totalExpectedQuartersInRange} quarters, but data was found/processed for only ${filteredForVerification.length}. Some charts or calculations might be incomplete.`);
        }


        filteredForVerification.forEach(d => {
            quartersInSelectedRange++;
            let kpisPresent = 0;
            if (d.productRevenueM === null || d.productRevenueM === undefined) missingRevenue++; else kpisPresent++;
            if (d.eps === null || d.eps === undefined) missingEps++; else kpisPresent++;
            if (d.fcfM === null || d.fcfM === undefined) missingFcf++; else kpisPresent++;
            if (d.netIncomeM === null || d.netIncomeM === undefined) missingNetIncome++; else kpisPresent++;

            if (d.netIncomeM !== null && d.productRevenueM !== null && d.netIncomeM > d.productRevenueM && d.productRevenueM > 0) { // check productRevenueM > 0 to avoid false positives with 0 revenue
                netIncomeGreaterThanRevenueCount++;
            }
            // Define "complete" as having at least 3 of the 4 main KPIs (Revenue, EPS, FCF, NetIncome)
            if (kpisPresent >=3) {
                validQuartersForCompleteness++;
            }
        });

        if (quartersInSelectedRange > 0) {
            if (missingRevenue === quartersInSelectedRange && quartersInSelectedRange > 1) currentWarnings.push(`Revenue data completely missing for all ${quartersInSelectedRange} quarters in selected range.`);
            else if (missingRevenue > 0) currentWarnings.push(`Revenue data missing for ${missingRevenue} quarter(s) in selected range.`);

            if (missingEps === quartersInSelectedRange && quartersInSelectedRange > 1) currentWarnings.push(`EPS data completely missing for all ${quartersInSelectedRange} quarters in selected range.`);
            else if (missingEps > 0) currentWarnings.push(`EPS data missing for ${missingEps} quarter(s) in selected range.`);

            if (missingFcf === quartersInSelectedRange && quartersInSelectedRange > 1) currentWarnings.push(`FCF data completely missing for all ${quartersInSelectedRange} quarters in selected range.`);
            else if (missingFcf > 0) currentWarnings.push(`FCF data missing for ${missingFcf} quarter(s) in selected range.`);

            if (missingNetIncome === quartersInSelectedRange && quartersInSelectedRange > 1) currentWarnings.push(`Net Income data completely missing for all ${quartersInSelectedRange} quarters in selected range.`);
            else if (missingNetIncome > 0) currentWarnings.push(`Net Income data missing for ${missingNetIncome} quarter(s) in selected range.`);
        }


        if (netIncomeGreaterThanRevenueCount > 0) {
            currentWarnings.push(`Potential Anomaly: Net Income was greater than Total Revenue in ${netIncomeGreaterThanRevenueCount} quarter(s).`);
        }

        if (totalExpectedQuartersInRange > 0) {
            const completenessRatio = validQuartersForCompleteness / totalExpectedQuartersInRange;
            if (validQuartersForCompleteness < totalExpectedQuartersInRange && completenessRatio < 0.7) { // If less than 70% of expected quarters have "complete" data
                 currentWarnings.push(`Data Completeness Low: Only ${validQuartersForCompleteness} of ${totalExpectedQuartersInRange} expected quarters in selected range have 3+ core KPIs. Results may be unreliable.`);
            }
        } else if (filteredForVerification.length > 0 && totalExpectedQuartersInRange === 0) {
             // This case means data was processed but it's outside the (possibly invalid) selected date range.
             currentWarnings.push(`Data was processed for ${filteredForVerification.length} quarter(s), but none fall within the selected date range. Please check date settings.`);
        }

        if (currentWarnings.length > 0) {
            // Filter out the generic demo key warning if other more specific warnings are present
            if (currentWarnings.length > 1 && currentWarnings[0].includes("Using 'demo' API key")) {
                 const specificWarnings = currentWarnings.filter(w => !w.includes("Using 'demo' API key"));
                 if (apiKey === 'demo') { // Add it back as a general note if other warnings exist
                    setVerificationWarning("Demo key in use. " + specificWarnings.join(" "));
                 } else {
                    setVerificationWarning(specificWarnings.join(" "));
                 }
            } else {
                 setVerificationWarning(currentWarnings.join(" "));
            }
        }
        // If there were no critical verification issues and some data was processed, clear any fetchError that might have been set by API issues but some data still came through.
        if (processedDataArray.length > 0 && !fetchError && (verificationWarning || "").length < currentWarnings.join(" ").length) {
             // Allow verification warnings to override a general no-data fetchError if some data was processed.
        } else if (processedDataArray.length > 0 && fetchError && currentWarnings.length === 0) {
            // If there was an API error but we got some data and no new warnings, clear the API error.
            // This handles cases where one API endpoint failed but others provided enough data.
            // setFetchError(null); // Potentially too aggressive, let's leave API errors if they occurred.
        }


      } else if (!fetchError) { // No data processed, and no API error previously set
        let noDataMsg = "No financial data found or processed for the company and period. Check ticker or broaden date range.";
        if (apiKey === 'demo') {
          noDataMsg = "No data processed with 'demo' key. This ticker may not be supported by the demo key (e.g. MSFT), or all calls failed. Try a common ticker like 'IBM' or set a real API key.";
        }
        setFetchError(noDataMsg);
      }
      // End of Data Verification Logic
      console.log("[fetchKpiData] Data verification complete. Warnings:", verificationWarning, "Errors:", fetchError);

      if (processedDataArray.length === 0 && !fetchError && !apiErrorOccurred) {
        // If no data processed, no previous fetchError, and no specific API error stopped things.
        let noDataMessage = `No financial data could be processed for ${ticker} for the selected period. The ticker might be invalid, data might not be available, or an API limit was reached.`;
        if (apiKey === 'demo') {
            noDataMessage = `No data processed for ${ticker} with 'demo' key. This ticker may not be supported by the demo key (e.g., many common tickers like MSFT, GOOG are not), or call limits were hit. Try 'IBM' with the demo key, or set a real API key.`;
        }
        setFetchError(noDataMessage);
      } else if (processedDataArray.length > 0 && !fetchError && apiKey === 'demo' && (!verificationWarning || !verificationWarning.includes("Using 'demo' API key")) ) {
        // If we have data, no fetch error, using demo key, and demo warning isn't already there.
        setVerificationWarning(prev => (prev ? prev + "; " : "") + "Using 'demo' API key. Data may be limited or outdated. For full access, set your Alpha Vantage API key.");
      }
      console.log("[fetchKpiData] Data fetching and processing finished.");

    } catch (err) { // Catch any unexpected errors not caught by inner try-catch blocks
      console.error("[fetchKpiData] Outer error during fetch/process:", err);
      if (!fetchError) { // Avoid overwriting specific API errors if already set
        setFetchError(`An unexpected error occurred: ${err.message}. Please check console or try again.`);
      }
      setRawQuarterlyData([]);
    } finally {
      console.log("[fetchKpiData] Fetch operation ended. isFetchingData=false");
      setIsFetchingData(false);
    }
  };

  // Fixed colors for the charts
  const colors = {
    'Total Revenue B': '#FFD700', // Light Orange
    'TTM FCF B': '#FF8C00', // Deep Orange
    'TTM EPS': '#FFFF00', // Yellow
    'Net Income M': '#ADD8E6', // Light Blue
  };


  // Formats a number as currency with a specified unit (e.g., "$1.23B" or "$123.45M")
  const formatCurrency = (value, unit = "B", showSign = false) => {
    if (typeof value !== 'number' || isNaN(value) || value === null) return "N/A";
    const formatted = `$${Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const sign = showSign && value !== 0 ? (value > 0 ? '+' : '-') : '';
    return `${sign}${formatted}${unit}`;
  };

  // Formats a number as a percentage (e.g., "15.0%")
  const formatPercent = (value) => {
    if (value === null || typeof value !== 'number' || isNaN(value)) return "N/A";
    if (value === Infinity) return "Growth > 1000%"; // Special handling for infinite growth
    if (value === -Infinity) return "Decline > 1000%"; // Special handling for infinite decline
    return `${(value * 100).toFixed(1)}%`; // Convert decimal to percentage for display
  };

  // Custom Tooltip component for Recharts, showing details on hover
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 text-white p-3 rounded-lg shadow-xl border border-gray-700">
          <p className="font-semibold text-blue-300 mb-1">{label}</p>
          {payload.map((item, index) => {
            let formattedValue;
            if (item.name.includes("B")) {
                formattedValue = formatCurrency(item.value, "B");
            } else if (item.name.includes("M")) {
                formattedValue = formatCurrency(item.value, "M");
            } else if (item.name.includes("EPS")) {
                formattedValue = `$${item.value?.toFixed(2)}`;
            }

            return (
              <p key={index} style={{ color: item.color }} className="text-sm">
                {`${item.name.replace(' B', '').replace('TTM ', '').replace(' M', '')}: ${formattedValue}`}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  // Defines border radius for the top of the bars to make them rounded
  const barRadius = [8, 8, 0, 0];

  // Log input changes
  useEffect(() => {
    console.log(`[Input Change] Company Name: ${companyName}`);
  }, [companyName]);
  useEffect(() => {
    console.log(`[Input Change] Ticker: ${ticker}`);
  }, [ticker]);
  useEffect(() => {
    console.log(`[Input Change] Start Quarter/Year: ${startQuarter}/${startYear}`);
  }, [startQuarter, startYear]);
  useEffect(() => {
    console.log(`[Input Change] End Quarter/Year: ${endQuarter}/${endYear}`);
  }, [endQuarter, endYear]);


  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 font-inter">
      {/* Header section for the dashboard */}
      <header className="mb-8 flex justify-between items-center">
        <h1 className="text-3xl md:text-4xl font-bold text-blue-400 drop-shadow-lg">Quarterly TTM Financials</h1>
        {companyName && ticker && (
          <div className="text-right">
            <p className="text-xl md:text-2xl font-semibold text-gray-300">{companyName} ({ticker})</p>
          </div>
        )}
      </header>

      {/* Input section for Company Name and Ticker */}
      <section className="bg-gray-800 p-4 md:p-6 rounded-xl shadow-2xl mb-8">
        <h2 className="text-2xl font-semibold mb-4 text-purple-300">Company Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <label htmlFor="companyName" className="block text-sm font-medium text-gray-300 mb-1">Company Name</label>
            <input
              type="text"
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Apple Inc."
              className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="ticker" className="block text-sm font-medium text-gray-300 mb-1">Ticker Symbol</label>
            <input
              type="text"
              id="ticker"
              value={ticker}
              onChange={(e) => setTicker(e.target.value.toUpperCase())}
              placeholder="e.g., AAPL"
              className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        </div>

        <h2 className="text-2xl font-semibold mb-4 text-purple-300 mt-6">Date Range</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
                <label htmlFor="startQuarter" className="block text-sm font-medium text-gray-300 mb-1">Start Quarter</label>
                <select
                    id="startQuarter"
                    value={startQuarter}
                    onChange={(e) => setStartQuarter(e.target.value)}
                    className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                    <option value="Q3">Q3</option>
                    <option value="Q4">Q4</option>
                </select>
            </div>
            <div>
                <label htmlFor="startYear" className="block text-sm font-medium text-gray-300 mb-1">Start Year</label>
                <input
                    type="number"
                    id="startYear"
                    value={startYear}
                    onChange={(e) => setStartYear(e.target.value)}
                    placeholder="e.g., 2020"
                    min="1900"
                    max={new Date().getFullYear()}
                    className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
            </div>
            <div>
                <label htmlFor="endQuarter" className="block text-sm font-medium text-gray-300 mb-1">End Quarter</label>
                <select
                    id="endQuarter"
                    value={endQuarter}
                    onChange={(e) => setEndQuarter(e.target.value)}
                    className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                    <option value="Q1">Q1</option>
                    <option value="Q2">Q2</option>
                    <option value="Q3">Q3</option>
                    <option value="Q4">Q4</option>
                </select>
            </div>
            <div>
                <label htmlFor="endYear" className="block text-sm font-medium text-gray-300 mb-1">End Year</label>
                <input
                    type="number"
                    id="endYear"
                    value={endYear}
                    onChange={(e) => setEndYear(e.target.value)}
                    placeholder="e.g., 2025"
                    min="1900"
                    max={new Date().getFullYear() + 1} // Allow one year into the future for estimates
                    className="w-full p-3 rounded-md bg-gray-700 border border-gray-600 text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
            </div>
        </div>

        <button
          onClick={fetchKpiData}
          disabled={isFetchingData || !companyName || !ticker || !startQuarter || !startYear || !endQuarter || !endYear}
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-md transition-all duration-300 ease-in-out transform hover:scale-105 shadow-lg"
        >
          {isFetchingData ? 'Fetching Data...' : 'Fetch Company KPIs'}
        </button>
      </section>

      {/* Loading and Error States */}
      {isFetchingData && (
        <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex justify-center items-center z-50">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500"></div>
          <p className="ml-4 text-xl text-gray-200">Fetching and processing data...</p>
        </div>
      )}
      {fetchError && !isFetchingData && (
        <div className="flex flex-col justify-center items-center p-6 bg-red-900 text-red-300 rounded-xl shadow-lg border border-red-700 mb-8">
          <div className="flex items-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mr-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-xl font-bold">Data Fetch Error</p>
          </div>
          <p className="text-md text-center mb-3">{fetchError}</p>
          <p className="text-xs mt-4 text-gray-400">Please ensure the company name and ticker are correct and the date range is valid. Data is sourced from Alpha Vantage API.</p>
        </div>
      )}
      {verificationWarning && !isFetchingData && (
        <div className="flex flex-col justify-center items-center p-4 bg-yellow-700 bg-opacity-80 text-yellow-200 rounded-xl shadow-lg border border-yellow-600 mb-8">
            <div className="flex items-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mr-3 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.216 3.006-1.742 3.006H4.42c-1.526 0-2.492-1.672-1.742-3.006l5.58-9.92zM10 13a1 1 0 110-2 1 1 0 010 2zm-1.002-6.002a1 1 0 011.906-.516l.094.188a1.002 1.002 0 01.194 1.316L11 9l.002.002a1 1 0 01-2-.002L9 8l-.002-.002a1.002 1.002 0 01.002-1.906z" clipRule="evenodd" />
                </svg>
                <p className="text-lg font-bold">Data Verification Warning</p>
            </div>
            <p className="text-sm text-center">{verificationWarning}</p>
        </div>
      )}

      {/* Main content grid for the charts - only display if data is loaded and no error */}
      {!isFetchingData && !fetchError && revenueTTMChartData.length > 0 && (
        <>
        {console.log(`[Render Charts] Conditions met. Rendering charts. Revenue points: ${revenueTTMChartData.length}, FCF: ${fcfTTMChartData.length}, EPS: ${epsTTMChartData.length}, Net Income: ${netIncomeTTMChartData.length}`)}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Revenue TTM Chart Section */}
          <section className="bg-gray-800 p-4 md:p-6 rounded-xl shadow-2xl transition-all duration-500 ease-in-out transform hover:shadow-yellow-500/50 hover:scale-[1.01]">
            <h2 className="text-2xl font-semibold mb-1 text-yellow-300">
              Revenue TTM
              {companyName && <span className="float-right text-lg text-gray-400">{companyName}</span>}
            </h2>
            <p className="text-xs text-gray-500 mb-4">Trailing Twelve Months Total Revenue</p>
            {revenueTTMChartData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={revenueTTMChartData} margin={{ top: 5, right: 10, left: 20, bottom: 70 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="Quarter" tick={{ fill: '#A0AEC0', fontSize: '0.7rem' }} angle={-45} textAnchor="end" height={75} interval={0}/>
                    <YAxis tickFormatter={(value) => formatCurrency(value, "B")} tick={{ fill: '#A0AEC0' }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128, 128, 128, 0.2)' }}/>
                    <Legend verticalAlign="bottom" wrapperStyle={{ bottom: 20, left: 20, color: '#A0AEC0' }} />
                    <Bar dataKey="Total Revenue B" fill={colors['Total Revenue B']} name="Total Revenue B" radius={barRadius} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 pt-3 border-t border-gray-700 text-xs text-gray-400 grid grid-cols-1 sm:grid-cols-3 gap-y-2 text-center md:text-left">
                  <p>1-Yr TTM Rev CAGR: <span className="font-semibold" style={{color: colors['Total Revenue B']}}>{formatPercent(calculatedCagrs.revenue1Yr)}</span></p>
                  <p>2-Yr TTM Rev CAGR: <span className="font-semibold" style={{color: colors['Total Revenue B']}}>{formatPercent(calculatedCagrs.revenue2Yr)}</span></p>
                  <p>4-Yr TTM Rev CAGR: <span className="font-semibold" style={{color: colors['Total Revenue B']}}>{formatPercent(calculatedCagrs.revenue4Yr)}</span></p>
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-center py-10">No data available for Revenue TTM to display.</p>
            )}
          </section>

          {/* Free Cash Flow TTM Chart Section */}
          <section className="bg-gray-800 p-4 md:p-6 rounded-xl shadow-2xl transition-all duration-500 ease-in-out transform hover:shadow-orange-500/50 hover:scale-[1.01]">
            <h2 className="text-2xl font-semibold mb-1 text-orange-300">
              Free Cash Flow TTM
              {companyName && <span className="float-right text-lg text-gray-400">{companyName}</span>}
            </h2>
            <p className="text-xs text-gray-500 mb-4">Trailing Twelve Months Free Cash Flow</p>
            {fcfTTMChartData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={fcfTTMChartData} margin={{ top: 5, right: 10, left: 20, bottom: 70 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="Quarter" tick={{ fill: '#A0AEC0', fontSize: '0.7rem' }} angle={-45} textAnchor="end" height={75} interval={0}/>
                    <YAxis tickFormatter={(value) => formatCurrency(value, "B")} tick={{ fill: '#A0AEC0' }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128, 128, 128, 0.2)' }}/>
                    <Legend verticalAlign="bottom" wrapperStyle={{ bottom: 20, left: 20, color: '#A0AEC0' }} />
                    <Bar dataKey="TTM FCF B" fill={colors['TTM FCF B']} name="TTM FCF B" radius={barRadius} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 pt-3 border-t border-gray-700 text-xs text-gray-400 grid grid-cols-1 sm:grid-cols-3 gap-y-2 text-center md:text-left">
                  <p>1-Yr TTM FCF CAGR: <span className="font-semibold" style={{color: colors['TTM FCF B']}}>{formatPercent(calculatedCagrs.fcf1Yr)}</span></p>
                  <p>2-Yr TTM FCF CAGR: <span className="font-semibold" style={{color: colors['TTM FCF B']}}>{formatPercent(calculatedCagrs.fcf2Yr)}</span></p>
                  <p>4-Yr TTM FCF CAGR: <span className="font-semibold" style={{color: colors['TTM FCF B']}}>{formatPercent(calculatedCagrs.fcf4Yr)}</span></p>
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-center py-10">No data available for FCF TTM to display.</p>
            )}
          </section>

          {/* Earnings Per Share TTM Chart Section */}
          <section className="bg-gray-800 p-4 md:p-6 rounded-xl shadow-2xl transition-all duration-500 ease-in-out transform hover:shadow-yellow-500/50 hover:scale-[1.01]">
            <h2 className="text-2xl font-semibold mb-1 text-yellow-300">
              Earnings Per Share TTM
              {companyName && <span className="float-right text-lg text-gray-400">{companyName}</span>}
            </h2>
            <p className="text-xs text-gray-500 mb-4">Trailing Twelve Months Earnings Per Share</p>
            {epsTTMChartData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={epsTTMChartData} margin={{ top: 5, right: 10, left: 20, bottom: 70 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="Quarter" tick={{ fill: '#A0AEC0', fontSize: '0.7rem' }} angle={-45} textAnchor="end" height={75} interval={0}/>
                    <YAxis tickFormatter={(value) => `$${value?.toFixed(2)}`} tick={{ fill: '#A0AEC0' }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128, 128, 128, 0.2)' }}/>
                    <Legend verticalAlign="bottom" wrapperStyle={{ bottom: 20, left: 20, color: '#A0AEC0' }} />
                    <Bar dataKey="TTM EPS" fill={colors['TTM EPS']} name="TTM EPS" radius={barRadius} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 pt-3 border-t border-gray-700 text-xs text-gray-400 grid grid-cols-1 sm:grid-cols-3 gap-y-2 text-center md:text-left">
                  <p>1-Yr TTM EPS CAGR: <span className="font-semibold" style={{color: colors['TTM EPS']}}>{formatPercent(calculatedCagrs.eps1Yr)}</span></p>
                  <p>2-Yr TTM EPS CAGR: <span className="font-semibold" style={{color: colors['TTM EPS']}}>{formatPercent(calculatedCagrs.eps2Yr)}</span></p>
                  <p>4-Yr TTM EPS CAGR: <span className="font-semibold" style={{color: colors['TTM EPS']}}>{formatPercent(calculatedCagrs.eps4Yr)}</span></p>
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-center py-10">No data available for EPS TTM to display.</p>
            )}
          </section>

          {/* Net Income TTM Chart Section */}
          <section className="bg-gray-800 p-4 md:p-6 rounded-xl shadow-2xl transition-all duration-500 ease-in-out transform hover:shadow-blue-500/50 hover:scale-[1.01]">
            <h2 className="text-2xl font-semibold mb-1 text-blue-300">
              Net Income TTM
              {companyName && <span className="float-right text-lg text-gray-400">{companyName}</span>}
            </h2>
            <p className="text-xs text-gray-500 mb-4">Trailing Twelve Months Net Income</p>
            {netIncomeTTMChartData.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={netIncomeTTMChartData} margin={{ top: 5, right: 10, left: 20, bottom: 70 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="Quarter" tick={{ fill: '#A0AEC0', fontSize: '0.7rem' }} angle={-45} textAnchor="end" height={75} interval={0}/>
                    <YAxis tickFormatter={(value) => formatCurrency(value, "M", true)} tick={{ fill: '#A0AEC0' }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128, 128, 128, 0.2)' }}/>
                    <Legend verticalAlign="bottom" wrapperStyle={{ bottom: 20, left: 20, color: '#A0AEC0' }} />
                    <Bar dataKey="Net Income M" fill={colors['Net Income M']} name="Net Income M" radius={barRadius} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 pt-3 border-t border-gray-700 text-xs text-gray-400 grid grid-cols-1 sm:grid-cols-3 gap-y-2 text-center md:text-left">
                  <p>1-Yr TTM Net Income CAGR: <span className="font-semibold" style={{color: colors['Net Income M']}}>{formatPercent(calculatedCagrs.netIncome1Yr)}</span></p>
                  <p>2-Yr TTM Net Income CAGR: <span className="font-semibold" style={{color: colors['Net Income M']}}>{formatPercent(calculatedCagrs.netIncome2Yr)}</span></p>
                  <p>4-Yr TTM Net Income CAGR: <span className="font-semibold" style={{color: colors['Net Income M']}}>{formatPercent(calculatedCagrs.netIncome4Yr)}</span></p>
                </div>
              </>
            ) : (
              <p className="text-gray-500 text-center py-10">No data available for Net Income TTM to display.</p>
            )}
          </section>

        </div>
        </>
      )}

      {/* Footer section with data source and disclaimer */}
      <footer className="mt-12 text-center text-gray-500 text-sm border-t border-gray-700 pt-6">
        <button
          onClick={() => setShowDebugPanel(!showDebugPanel)}
          className="mb-4 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-md transition-colors duration-300"
        >
          {showDebugPanel ? 'Hide' : 'Show'} Debug Panel
        </button>
        {showDebugPanel && (
          <div className="mt-4 p-4 bg-gray-800 rounded-xl shadow-inner text-left">
            <h3 className="text-xl font-semibold text-purple-300 mb-3">Debug Information</h3>

            <div className="mb-4">
              <h4 className="text-lg font-semibold text-gray-300 mb-1">Raw Income Statement API Response:</h4>
              <pre className="bg-gray-900 p-3 rounded-md text-xs overflow-auto max-h-64">
                <code>{JSON.stringify(rawIncomeStatement, null, 2) || "Not fetched"}</code>
              </pre>
            </div>

            <div className="mb-4">
              <h4 className="text-lg font-semibold text-gray-300 mb-1">Raw Cash Flow API Response:</h4>
              <pre className="bg-gray-900 p-3 rounded-md text-xs overflow-auto max-h-64">
                <code>{JSON.stringify(rawCashFlow, null, 2) || "Not fetched"}</code>
              </pre>
            </div>

            <div className="mb-4">
              <h4 className="text-lg font-semibold text-gray-300 mb-1">Raw Earnings API Response:</h4>
              <pre className="bg-gray-900 p-3 rounded-md text-xs overflow-auto max-h-64">
                <code>{JSON.stringify(rawEarnings, null, 2) || "Not fetched"}</code>
              </pre>
            </div>

            <div>
              <h4 className="text-lg font-semibold text-gray-300 mb-1">Processed Raw Quarterly Data (for TTM):</h4>
              <pre className="bg-gray-900 p-3 rounded-md text-xs overflow-auto max-h-96">
                <code>{JSON.stringify(rawQuarterlyData, null, 2) || "Not processed"}</code>
              </pre>
            </div>
          </div>
        )}
        <p className="mt-6">Data is sourced from Alpha Vantage API and is presented for **informational purposes only**.</p>
        <p className="mt-2">This dashboard should not be construed as financial advice. Always verify with official financial reports for any investment decisions.</p>
      </footer>
    </div>
  );
};

export default App;
