import React from 'react';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';

const DataTable = ({ data }) => {
  return (
    <Paper style={{ marginTop: '20px', padding: '20px' }}>
      <Typography variant="h6" style={{ marginBottom: '10px' }}>Data Table</Typography>
      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Month</TableCell>
              <TableCell align="right">Revenue</TableCell>
              <TableCell align="right">Expenses</TableCell>
              <TableCell align="right">Net Profit</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.month}>
                <TableCell component="th" scope="row">
                  {row.month}
                </TableCell>
                <TableCell align="right">${row.revenue}</TableCell>
                <TableCell align="right">${row.expenses}</TableCell>
                <TableCell align="right">${row.netProfit}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
};

export default DataTable;
