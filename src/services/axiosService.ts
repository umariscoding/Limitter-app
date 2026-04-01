import type { AxiosInstance, AxiosRequestConfig, AxiosResponse as RawAxiosResponse } from "axios";
import axios from "axios";
import { BASE_URL } from "../config/config";
import { auth } from "../config/firebase";

interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  status: number;
}

class AxiosService {
  static instance: AxiosService;
  private axiosInstance!: AxiosInstance;

  constructor() {
    if (AxiosService.instance) {
      return AxiosService.instance;
    }

    this.axiosInstance = axios.create({
      baseURL: BASE_URL,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    });

    this.setupInterceptors();
    AxiosService.instance = this;
  }

  private setupInterceptors() {
    this.axiosInstance.interceptors.request.use(
      async (config) => {
        const user = auth.currentUser;
        if (user) {
          const token = await user.getIdToken(false);
          if (token) {
            config.headers["Authorization"] = `Bearer ${token}`;
          }
        }
        return config;
      },
      (error) => Promise.reject(error),
    );

    this.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const apiMessage = error?.response?.data?.message;
        if (apiMessage) {
          error.message = apiMessage;
        }
        return Promise.reject(error);
      },
    );
  }

  public async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: RawAxiosResponse<ApiEnvelope<T>> =
      await this.axiosInstance.get(url, config);
    return response.data.data;
  }

  public async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: RawAxiosResponse<ApiEnvelope<T>> =
      await this.axiosInstance.post(url, data, config);
    return response.data.data;
  }

  public async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: RawAxiosResponse<ApiEnvelope<T>> =
      await this.axiosInstance.put(url, data, config);
    return response.data.data;
  }

  public async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response: RawAxiosResponse<ApiEnvelope<T>> =
      await this.axiosInstance.delete(url, config);
    return response.data.data;
  }

  public async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response: RawAxiosResponse<ApiEnvelope<T>> =
      await this.axiosInstance.patch(url, data, config);
    return response.data.data;
  }
}

const axiosService = new AxiosService();
export default axiosService;
