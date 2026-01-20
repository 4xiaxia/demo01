/**
 * 全局路径配置
 * 
 * 集中管理所有文件路径，避免硬编码和路径不一致问题
 */

import path from "path";

/**
 * 项目根目录
 */
export const ROOT_DIR = process.cwd();

/**
 * 商户数据根目录 (前端访问)
 * 路径: public/data/{merchantId}/
 */
export const PUBLIC_DATA_DIR = path.join(ROOT_DIR, "public", "data");

/**
 * 商户配置根目录 (后端专用)
 * 路径: server/merchant/{merchantId}/
 */
export const MERCHANT_CONFIG_DIR = path.join(ROOT_DIR, "server", "merchant");

/**
 * 获取商户公开数据目录
 * @param merchantId 商户ID
 * @returns public/data/{merchantId}/
 */
export function getPublicDataPath(merchantId: string): string {
  return path.join(PUBLIC_DATA_DIR, merchantId);
}

/**
 * 获取商户配置目录
 * @param merchantId 商户ID
 * @returns server/merchant/{merchantId}/
 */
export function getMerchantConfigPath(merchantId: string): string {
  return path.join(MERCHANT_CONFIG_DIR, merchantId);
}

/**
 * 获取知识库文件路径
 * @param merchantId 商户ID
 * @returns public/data/{merchantId}/knowledge.json
 */
export function getKnowledgePath(merchantId: string): string {
  return path.join(PUBLIC_DATA_DIR, merchantId, "knowledge.json");
}

/**
 * 获取配置文件路径
 * @param merchantId 商户ID
 * @returns public/data/{merchantId}/config.json
 */
export function getPublicConfigPath(merchantId: string): string {
  return path.join(PUBLIC_DATA_DIR, merchantId, "config.json");
}

/**
 * 获取后端配置文件路径
 * @param merchantId 商户ID
 * @returns server/merchant/{merchantId}/config.json
 */
export function getServerConfigPath(merchantId: string): string {
  return path.join(MERCHANT_CONFIG_DIR, merchantId, "config.json");
}

/**
 * 获取热门问题文件路径
 * @param merchantId 商户ID
 * @returns server/merchant/{merchantId}/hot-questions.json
 */
export function getHotQuestionsPath(merchantId: string): string {
  return path.join(MERCHANT_CONFIG_DIR, merchantId, "hot-questions.json");
}
