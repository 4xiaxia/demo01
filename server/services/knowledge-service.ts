import fs from "fs/promises";
import { getKnowledgePath } from "../config/paths";

export interface KnowledgeItem {
  id: string;
  name: string;
  content: string;
  keywords: string[];
  category: "price" | "info" | "service" | "route" | "facility";
  enabled: boolean;
  isHot?: boolean;
  weight?: number;
}

/**
 * 知识库业务服务
 * 实现知识库的加载、存储、备份等核心逻辑，与路由解耦
 */
export class KnowledgeService {
  /**
   * 加载商户知识库
   */
  static async load(merchantId: string): Promise<KnowledgeItem[]> {
    const path = getKnowledgePath(merchantId);
    try {
      const content = await fs.readFile(path, "utf-8");
      const data = JSON.parse(content);
      return Array.isArray(data) ? data : (data.items || []);
    } catch {
      console.warn(`[KnowledgeService] 无法加载 ${merchantId} 的知识库，返回空列表`);
      return [];
    }
  }

  /**
   * 保存商户知识库
   */
  static async save(merchantId: string, items: KnowledgeItem[]): Promise<boolean> {
    const path = getKnowledgePath(merchantId);
    try {
      await fs.writeFile(path, JSON.stringify({
        merchantId,
        updatedAt: new Date().toISOString(),
        items
      }, null, 2));
      return true;
    } catch (error) {
      console.error(`[KnowledgeService] 保存失败:`, error);
      return false;
    }
  }

  /**
   * 追加单条知识 (常用于报缺转热门)
   */
  static async append(merchantId: string, newItem: KnowledgeItem): Promise<boolean> {
    const items = await this.load(merchantId);
    // 检查是否已存在
    if (items.find(i => i.name === newItem.name)) return false;
    
    items.push(newItem);
    return await this.save(merchantId, items);
  }
}
