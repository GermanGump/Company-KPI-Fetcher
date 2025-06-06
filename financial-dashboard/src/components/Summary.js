import React from 'react';
import { Paper, Typography, Grid } from '@mui/material';

const Summary = ({ data }) => {
  // Calculate summary statistics (dummy data for now)
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);
  const totalExpenses = data.reduce((sum, item) => sum + item.expenses, 0);
  const netProfit = totalRevenue - totalExpenses;

  return (
    <Grid container spacing={3}>
      <Grid item xs={12} sm={4}>
        <Paper style={{ padding: '20px', textAlign: 'center' }}>
          <Typography variant="h6">Total Revenue</Typography>
          <Typography variant="h4">${totalRevenue}</Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} sm={4}>
        <Paper style={{ padding: '20px', textAlign: 'center' }}>
          <Typography variant="h6">Total Expenses</Typography>
          <Typography variant="h4">${totalExpenses}</Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} sm={4}>
        <Paper style={{ padding: '20px', textAlign: 'center' }}>
          <Typography variant="h6">Net Profit</Typography>
          <Typography variant="h4">${netProfit}</Typography>
        </Paper>
      </Grid>
    </Grid>
  );
};

export default Summary;
