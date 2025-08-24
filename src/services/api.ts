import axios from 'axios';
import { FlashSaleStatus, PurchaseResult, UserPurchaseStatus } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export class FlashSaleAPI {
  static async getStatus(): Promise<FlashSaleStatus> {
    const response = await api.get('/flash-sale/status');
    return response.data;
  }

  static async attemptPurchase(userId: string): Promise<PurchaseResult> {
    const response = await api.post('/flash-sale/purchase', { userId });
    return response.data;
  }

  static async checkUserPurchase(userId: string): Promise<UserPurchaseStatus> {
    const response = await api.get(`/flash-sale/purchase/${userId}`);
    return response.data;
  }
}
