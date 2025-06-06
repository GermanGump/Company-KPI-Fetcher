import React from 'react';
import { Paper, Typography, Grid } from '@mui/material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

const Charts = ({ data }) => {
  return (
    <Grid container spacing={3} style={{ marginTop: '20px' }}>
      <Grid item xs={12} md={6}>
        <Paper style={{ padding: '20px' }}>
          <Typography variant="h6">Revenue and Expenses (Bar Chart)</Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="revenue" fill="#8884d8" name="Revenue" />
              <Bar dataKey="expenses" fill="#82ca9d" name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      </Grid>
      <Grid item xs={12} md={6}>
        <Paper style={{ padding: '20px' }}>
          <Typography variant="h6">Net Profit Over Time (Line Chart)</Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="netProfit" stroke="#ff7300" name="Net Profit" />
            </LineChart>
          </ResponsiveContainer>
        </Paper>
      </Grid>
    </Grid>
  );
};

export default Charts;
