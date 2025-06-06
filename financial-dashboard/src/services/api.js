import axios from 'axios';

// Mock data for now
const mockData = [
  { month: 'Jan', revenue: 10000, expenses: 7000, netProfit: 3000 },
  { month: 'Feb', revenue: 12000, expenses: 7500, netProfit: 4500 },
  { month: 'Mar', revenue: 15000, expenses: 8000, netProfit: 7000 },
  { month: 'Apr', revenue: 13000, expenses: 8200, netProfit: 4800 },
  { month: 'May', revenue: 16000, expenses: 9000, netProfit: 7000 },
  { month: 'Jun', revenue: 17000, expenses: 9500, netProfit: 7500 },
];

export const getFinancialData = async () => {
  // In a real application, you would fetch data from an API:
  // try {
  //   const response = await axios.get('/api/financial-data');
  //   return response.data;
  // } catch (error) {
  //   console.error('Error fetching financial data:', error);
  //   throw error;
  // }

  // For now, return mock data with a slight delay to simulate API call
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(mockData);
    }, 500);
  });
};
