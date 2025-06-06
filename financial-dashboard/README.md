# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

It is a dynamic financial dashboard that allows users to input a company ticker and a date range to visualize Trailing Twelve Months (TTM) data for key financial metrics like Revenue, EPS, FCF, and Net Income. The dashboard also calculates and displays 1-year, 2-year, and 4-year Compound Annual Growth Rates (CAGRs) for these metrics.

## Key Features
- Dynamic data fetching from Alpha Vantage API based on user-provided ticker symbol.
- Customizable date range for financial data analysis.
- Calculation and display of Trailing Twelve Months (TTM) for:
    - Total Revenue
    - Earnings Per Share (EPS)
    - Free Cash Flow (FCF)
    - Net Income
- Calculation and display of 1-Yr, 2-Yr, and 4-Yr CAGRs for the TTM metrics.
- Interactive charts for visualizing financial trends.
- Debug panel to inspect raw API responses and processed data.
- Client-side data verification and user-friendly error/warning messages.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Usage Guide

### Getting an API Key
1. Go to [https://www.alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key) to claim your free Alpha Vantage API key.
2. This key is required for the dashboard to fetch financial data. Keep it secure.
3. You will need to set this API key as an environment variable when deploying the application (see Deployment section) or locally by creating a `.env` file in the project root with `REACT_APP_ALPHA_VANTAGE_API_KEY=YOUR_KEY_HERE`.

### Using the Dashboard
1.  **Enter Company Information:**
    *   **Company Name:** (e.g., Apple Inc.) - This is used for display purposes.
    *   **Ticker Symbol:** (e.g., AAPL) - This is crucial for fetching data. Use the correct stock ticker.
2.  **Select Date Range:**
    *   **Start Quarter/Year:** The beginning of the period for which you want to see TTM data.
    *   **End Quarter/Year:** The end of the period.
3.  **Fetch Data:** Click the "Fetch Company KPIs" button. The application will retrieve data from Alpha Vantage.
4.  **View Charts:**
    *   Once data is fetched, four charts will display Trailing Twelve Months (TTM) data for:
        *   Revenue TTM
        *   EPS TTM
        *   FCF TTM
        *   Net Income TTM
    *   Each chart includes CAGR (Compound Annual Growth Rate) figures for 1-year, 2-year, and 4-year periods, calculated from the TTM data.
    *   Legends are provided below each chart.
5.  **Debug Panel:**
    *   A "Show/Hide Debug Panel" button is available in the footer.
    *   This panel can help troubleshoot issues by showing:
        *   Raw JSON data received from Alpha Vantage for each financial statement.
        *   The processed `rawQuarterlyData` that is used to generate the charts.

### Data Source Note
Data is sourced from Alpha Vantage. The free tier has limitations (e.g., 25 API calls per day, and some popular tickers might be restricted). If you encounter frequent errors or missing data for common tickers, it might be due to these limits. Using your own key is highly recommended.

## Deployment

This project is a standard Create React App and can be deployed to any platform that supports static site hosting.

1.  **Build the Project:** Run `npm run build` in the project's root directory. This will create a `build` folder with static assets.
2.  **Choose a Hosting Platform:**
    *   **Netlify/Vercel:** Connect your Git repository. Configure the build command as `npm install && npm run build` (or just `npm run build` if dependencies are cached/managed by the platform) and the publish directory as `build`.
    *   **GitHub Pages:** Configure your repository to deploy from the `gh-pages` branch (after pushing the `build` folder's contents there) or use GitHub Actions to automate the build and deployment.
3.  **Environment Variable:**
    *   You **MUST** set the `REACT_APP_ALPHA_VANTAGE_API_KEY` environment variable on your hosting platform. This is your personal API key from Alpha Vantage.
    *   Example: If using Netlify, go to Site settings > Build & deploy > Environment > Environment variables, and add `REACT_APP_ALPHA_VANTAGE_API_KEY` with your key as the value.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
