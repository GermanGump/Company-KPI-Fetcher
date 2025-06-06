import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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

  // Calculated CAGR/Growth rates
  const [calculatedCagrs, setCalculatedCagrs] = useState({
    revenue1Yr: null, revenue2Yr: null, revenue4Yr: null,
    eps1Yr: null, eps2Yr: null, eps4Yr: null,
    fcf1Yr: null, fcf2Yr: null, fcf4Yr: null,
    netIncome1Yr: null, netIncome2Yr: null, netIncome4Yr: null,
  });

  // Helper function to calculate Compound Annual Growth Rate (CAGR)
  const calculateCAGR = (endValue, startValue, years) => {
    if (startValue === 0 || isNaN(startValue) || endValue === null || startValue === null || years <= 0 || isNaN(endValue)) return null;

    if (startValue < 0 && endValue < 0) {
        // Both negative: growth if magnitude decreases, decline if magnitude increases
        if (endValue > startValue) { // e.g., from -100 to -50 (growth)
            return (Math.abs(endValue) / Math.abs(startValue)) ** (1 / years) - 1;
        } else { // e.g., from -50 to -100 (decline)
            return -((Math.abs(startValue) / Math.abs(endValue)) ** (1 / years) - 1);
        }
    } else if (startValue < 0 && endValue >= 0) {
        // From negative to positive or zero is typically considered very high or infinite growth.
        // From negative to positive or zero (always considered growth)
        return Infinity; // Indicates large positive growth (swing from negative/zero to positive)
    } else if (startValue >= 0 && endValue < 0) {
        // From positive or zero to negative (always considered decline)
        return -((Math.abs(endValue) / startValue) ** (1 / years) - 1); // This will be a negative CAGR
    } else if (startValue === 0 && endValue > 0) {
        return Infinity; // Infinite growth from zero
    } else if (startValue > 0 && endValue === 0) {
        return -1; // 100% decline to zero
    }

    return (endValue / startValue) ** (1 / years) - 1;
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
        // Ensure enough preceding quarters for TTM calculation
        if (i >= 3) {
          // TTM Revenue (sum of product and service revenue)
          const totalRevenueTTM = (fullDataRange.slice(i - 3, i + 1).reduce((sum, q) => sum + (q.productRevenueM || 0) + (q.serviceRevenueM || 0), 0)) / 1_000_000_000;
          ttmRevenueData.push({
            Quarter: currentQuarterDisplay,
            'Total Revenue B': parseFloat(totalRevenueTTM.toFixed(2)),
          });

          // TTM Free Cash Flow
          const fcfTTM = (fullDataRange.slice(i - 3, i + 1).reduce((sum, q) => sum + (q.fcfM || 0), 0)) / 1_000_000_000;
          ttmFcfData.push({
            Quarter: currentQuarterDisplay,
            'TTM FCF B': parseFloat(fcfTTM.toFixed(2)),
          });

          // TTM Earnings Per Share
          const epsTTM = fullDataRange.slice(i - 3, i + 1).reduce((sum, q) => sum + (q.eps || 0), 0);
          ttmEpsData.push({
            Quarter: currentQuarterDisplay,
            'TTM EPS': parseFloat(epsTTM.toFixed(2)),
          });

          // TTM Net Income
          const netIncomeTTM = fullDataRange.slice(i - 3, i + 1).reduce((sum, q) => sum + (q.netIncomeM || 0), 0);
          ttmNetIncomeData.push({
            Quarter: currentQuarterDisplay,
            'Net Income M': parseFloat(netIncomeTTM.toFixed(2)),
          });
        }
      }
    }

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
    if (!latestQuarterInChart) return; // Exit if no data to calculate from


    // Revenue TTM CAGR Calculation
    const latestRevenueTTM = getQuarterDataPoint(revenueTTMChartData, latestQuarterInChart, 'Total Revenue B');
    const revenue1YrAgo = getQuarterDataPoint(revenueTTMChartData, getRelativeQuarter(latestQuarterInChart, 1), 'Total Revenue B');
    const revenue2YrAgo = getQuarterDataPoint(revenueTTMChartData, getRelativeQuarter(latestQuarterInChart, 2), 'Total Revenue B');
    const revenue4YrAgo = getQuarterDataPoint(revenueTTMChartData, getRelativeQuarter(latestQuarterInChart, 4), 'Total Revenue B');

    const cagrRevenue1Yr = calculateCAGR(latestRevenueTTM, revenue1YrAgo, 1);
    const cagrRevenue2Yr = calculateCAGR(latestRevenueTTM, revenue2YrAgo, 2);
    const cagrRevenue4Yr = calculateCAGR(latestRevenueTTM, revenue4YrAgo, 4);

    // EPS TTM CAGR Calculation
    const latestEpsTTM = getQuarterDataPoint(epsTTMChartData, latestQuarterInChart, 'TTM EPS');
    const eps1YrAgo = getQuarterDataPoint(epsTTMChartData, getRelativeQuarter(latestQuarterInChart, 1), 'TTM EPS');
    const eps2YrAgo = getQuarterDataPoint(epsTTMChartData, getRelativeQuarter(latestQuarterInChart, 2), 'TTM EPS');
    const eps4YrAgo = getQuarterDataPoint(epsTTMChartData, getRelativeQuarter(latestQuarterInChart, 4), 'TTM EPS');

    const cagrEps1Yr = calculateCAGR(latestEpsTTM, eps1YrAgo, 1);
    const cagrEps2Yr = calculateCAGR(latestEpsTTM, eps2YrAgo, 2);
    const cagrEps4Yr = calculateCAGR(latestEpsTTM, eps4YrAgo, 4);

    // FCF TTM CAGR Calculation
    const latestFcfTTM = getQuarterDataPoint(fcfTTMChartData, latestQuarterInChart, 'TTM FCF B');
    const fcf1YrAgo = getQuarterDataPoint(fcfTTMChartData, getRelativeQuarter(latestQuarterInChart, 1), 'TTM FCF B');
    const fcf2YrAgo = getQuarterDataPoint(fcfTTMChartData, getRelativeQuarter(latestQuarterInChart, 2), 'TTM FCF B');
    const fcf4YrAgo = getQuarterDataPoint(fcfTTMChartData, getRelativeQuarter(latestQuarterInChart, 4), 'TTM FCF B');

    const cagrFcf1Yr = calculateCAGR(latestFcfTTM, fcf1YrAgo, 1);
    const cagrFcf2Yr = calculateCAGR(latestFcfTTM, fcf2YrAgo, 2);
    const cagrFcf4Yr = calculateCAGR(latestFcfTTM, fcf4YrAgo, 4);

    // Net Income TTM CAGR Calculation
    const latestNetIncomeTTM = getQuarterDataPoint(netIncomeTTMChartData, latestQuarterInChart, 'Net Income M');
    const netIncome1YrAgo = getQuarterDataPoint(netIncomeTTMChartData, getRelativeQuarter(latestQuarterInChart, 1), 'Net Income M');
    const netIncome2YrAgo = getQuarterDataPoint(netIncomeTTMChartData, getRelativeQuarter(latestQuarterInChart, 2), 'Net Income M');
    const netIncome4YrAgo = getQuarterDataPoint(netIncomeTTMChartData, getRelativeQuarter(latestQuarterInChart, 4), 'Net Income M');

    const cagrNetIncome1Yr = calculateCAGR(latestNetIncomeTTM, netIncome1YrAgo, 1);
    const cagrNetIncome2Yr = calculateCAGR(latestNetIncomeTTM, netIncome2YrAgo, 2);
    const cagrNetIncome4Yr = calculateCAGR(latestNetIncomeTTM, netIncome4YrAgo, 4);

    setCalculatedCagrs({
      revenue1Yr: cagrRevenue1Yr, revenue2Yr: cagrRevenue2Yr, revenue4Yr: cagrRevenue4Yr,
      eps1Yr: cagrEps1Yr, eps2Yr: cagrEps2Yr, eps4Yr: cagrEps4Yr,
      fcf1Yr: cagrFcf1Yr, fcf2Yr: cagrFcf2Yr, fcf4Yr: cagrFcf4Yr,
      netIncome1Yr: cagrNetIncome1Yr, netIncome2Yr: cagrNetIncome2Yr, netIncome4Yr: cagrNetIncome4Yr,
    });

    } catch (error) {
      console.error("Error calculating CAGRs:", error);
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
    setRawQuarterlyData([]); // Clear previous data

    const prompt = `
      Generate a JSON object containing comprehensive historical quarterly financial data for ${companyName} (${ticker}).
      I need values from Q1 2018 up to ${endQuarter} ${endYear}, if available. Ensure enough historical data to calculate TTM for the entire requested period.
      All monetary values should be in millions USD, rounded to 2 decimal places, and EPS should be rounded to 2 decimal places. Profit margin should be a decimal rounded to 4 places.
      It is crucial that the data provided is accurate and directly verifiable from the company\'s publicly available financial statements (e.g., SEC filings or investor relations reports). Do not hallucinate or estimate data if official quarterly figures are not available for a specific metric; provide null or 0 in such cases.

      Include the following fields for each quarter, ensuring they are suitable for calculating Trailing Twelve Months (TTM) figures:

      - quarter (string, e.g., "Q1 2021")
      - productRevenueM (float, Product Revenue in millions USD, quarterly, accurate and verifiable)
      - serviceRevenueM (float, Service Revenue in millions USD, quarterly, accurate and verifiable)
      - eps (float, Diluted Earnings Per Share, quarterly, accurate and verifiable)
      - fcfM (float, Free Cash Flow in millions USD, quarterly, accurate and verifiable)
      - netIncomeM (float, Net Income in millions USD, quarterly, accurate and verifiable)
      - profitMargin (float, Profit Margin as a decimal, quarterly, calculated as (Net Income / Total Revenue) for the quarter, accurate and verifiable)

      Ensure the quarterlyData array is ordered chronologically from oldest to newest.

      Example JSON structure:
      {
        "quarterlyData": [
          {
            "quarter": "Q1 2018",
            "productRevenueM": 49021.00,
            "serviceRevenueM": 39865.00,
            "eps": 10.30,
            "fcfM": 8900.00,
            "netIncomeM": 5812.00,
            "profitMargin": 0.0654
          },
          {
            "quarter": "Q2 2018",
            "productRevenueM": 52758.00,
            "serviceRevenueM": 43534.00,
            "eps": 12.37,
            "fcfM": 12300.00,
            "netIncomeM": 6331.00,
            "profitMargin": 0.0660
          },
          // ... more quarters up to ${endQuarter} ${endYear}
        ]
      }
    `;

    try {
      const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY || ""; // Attempt to read from environment variable; fallback to empty string if not set.
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API error: ${response.status} ${response.statusText} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        let jsonString = result.candidates[0].content.parts[0].text;

        // Remove markdown code block delimiters if present
        if (jsonString.startsWith('```json\n')) {
            jsonString = jsonString.substring(8);
        } else if (jsonString.startsWith('```json')) {
            jsonString = jsonString.substring(7);
        }
        if (jsonString.endsWith('\n```')) {
            jsonString = jsonString.substring(0, jsonString.length - 4);
        } else if (jsonString.endsWith('```')) {
            jsonString = jsonString.substring(0, jsonString.length - 3);
        }

        // Attempt to clean trailing commas and other common JSON issues
        jsonString = jsonString.replace(/,(\s*[\]}])/g, '$1');
        jsonString = jsonString.trim();

        const parsedData = JSON.parse(jsonString);
        if (parsedData.quarterlyData && Array.isArray(parsedData.quarterlyData)) {
          setRawQuarterlyData(parsedData.quarterlyData);
          setFetchError(null);
        } else {
          throw new Error("Gemini response did not contain \'quarterlyData\' array or was malformed. Please try adjusting the date range or ticker.");
        }
      } else {
        throw new Error("Gemini did not return valid content. Please try adjusting the date range or ticker.");
      }
    } catch (err) {
      console.error("Error fetching or parsing Gemini data:", err);
      setFetchError(`Failed to fetch or parse data: ${err.message}. Please check your input or try again.`);
    } finally {
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

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8 font-inter">
      {/* Header section for the dashboard */}
      <header className="mb-8 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-blue-400 drop-shadow-lg">Dynamic Company KPI Dashboard</h1>
        <p className="text-lg text-gray-400 mt-2">Generate Financial KPI Charts for Any Company</p>
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
        <div className="flex justify-center items-center h-48 bg-gray-800 rounded-xl shadow-lg">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          <p className="ml-3 text-lg text-gray-300">Fetching and processing data...</p>
        </div>
      )}
      {fetchError && (
        <div className="flex flex-col justify-center items-center p-6 bg-red-900 text-red-300 rounded-xl shadow-lg border border-red-700 mb-8">
          <div className="flex items-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mr-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-xl font-bold">Data Fetch Error</p>
          </div>
          <p className="text-md text-center mb-3">{fetchError}</p>
          <p className="text-xs mt-4 text-gray-400">Please ensure the company name and ticker are correct and the date range is valid. Data is sourced from Gemini API.</p>
        </div>
      )}

      {/* Main content grid for the charts - only display if data is loaded and no error */}
      {!isFetchingData && !fetchError && revenueTTMChartData.length > 0 && (
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
                  <BarChart data={revenueTTMChartData} margin={{ top: 5, right: 10, left: 20, bottom: 50 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="Quarter" tick={{ fill: '#A0AEC0', fontSize: '0.7rem' }} angle={-45} textAnchor="end" height={75} interval={0}/>
                    <YAxis tickFormatter={(value) => formatCurrency(value, "B")} tick={{ fill: '#A0AEC0' }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128, 128, 128, 0.2)' }}/>
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
                  <BarChart data={fcfTTMChartData} margin={{ top: 5, right: 10, left: 20, bottom: 50 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="Quarter" tick={{ fill: '#A0AEC0', fontSize: '0.7rem' }} angle={-45} textAnchor="end" height={75} interval={0}/>
                    <YAxis tickFormatter={(value) => formatCurrency(value, "B")} tick={{ fill: '#A0AEC0' }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128, 128, 128, 0.2)' }}/>
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
                  <BarChart data={epsTTMChartData} margin={{ top: 5, right: 10, left: 20, bottom: 50 }} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="Quarter" tick={{ fill: '#A0AEC0', fontSize: '0.7rem' }} angle={-45} textAnchor="end" height={75} interval={0}/>
                    <YAxis tickFormatter={(value) => `$${value?.toFixed(2)}`} tick={{ fill: '#A0AEC0' }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128, 128, 128, 0.2)' }}/>
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
                  <BarChart data={netIncomeTTMChartData} margin={{ top: 5, right: 10, left: 20, bottom: 50 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                    <XAxis dataKey="Quarter" tick={{ fill: '#A0AEC0', fontSize: '0.7rem' }} angle={-45} textAnchor="end" height={75} interval={0}/>
                    <YAxis tickFormatter={(value) => formatCurrency(value, "M", true)} tick={{ fill: '#A0AEC0' }} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(128, 128, 128, 0.2)' }}/>
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
      )}

      {/* Footer section with data source and disclaimer */}
      <footer className="mt-12 text-center text-gray-500 text-sm border-t border-gray-700 pt-6">
        <p>Data is sourced from Gemini API and is presented for **informational purposes only**.</p>
        <p className="mt-2">This dashboard should not be construed as financial advice. Always verify with official financial reports for any investment decisions.</p>
      </footer>
    </div>
  );
};

export default App;
