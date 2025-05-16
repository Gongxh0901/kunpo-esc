/**
 * 稀疏集合 (SparseSet) 实现
 * 一种高效的数据结构，用于ECS系统中存储和管理组件
 * 提供O(1)复杂度的添加、删除和查找操作
 */

import { IComponent } from "../component/IComponent";
import { Entity } from "../entity/Entity";
export class SparseSet<T extends IComponent> {
    /**
     * 存储实际组件数据的密集数组
     * @internal
     */
    private dense: T[] = [];

    /**
     * 实体到密集数组索引的映射 (实体 -> 数组索引)
     * @internal
     */
    private readonly sparse: Map<Entity, number> = new Map();

    /**
     * 密集数组索引实体的反向映射 (数组索引 == 实体索引)
     * @internal
     */
    private entities: Entity[] = [];

    /**
     * 添加或更新组件
     * @param entity 实体
     * @param component 组件数据
     * @internal
     */
    public add(entity: Entity, component: T): void {
        // 添加到密集数组末尾
        const index = this.dense.length;
        this.dense.push(component);
        this.entities.push(entity);

        // 更新映射
        this.sparse.set(entity, index);
    }

    /**
     * 删除实体上的组件
     * @param entity 实体
     * @returns 返回被删除的组件
     * @internal
     */
    public remove(entity: Entity): T {
        const index = this.sparse.get(entity)!;
        const lastIndex = this.dense.length - 1;

        // 如果不是最后一个元素，用最后一个元素替换被删除的元素
        if (index !== lastIndex) {
            // 移动最后一个元素到当前位置
            this.dense[index] = this.dense[lastIndex];
            const lastEntity = this.entities[lastIndex];
            this.entities[index] = lastEntity;

            // 更新最后一个元素的映射
            this.sparse.set(lastEntity, index);
        }

        // 移除最后一个元素
        let component = this.dense.pop();
        this.entities.pop();

        // 删除映射
        this.sparse.delete(entity);
        return component;
    }

    /**
     * 获取组件
     * @param entity 实体
     * @returns 组件
     * @internal
     */
    public get(entity: Entity): T {
        const index = this.sparse.get(entity)!;
        return this.dense[index];
    }

    /**
     * 遍历所有组件
     * @param callback 回调函数，参数为组件和实体ID
     * @internal
     */
    public forEach(callback: (component: T, entity: Entity) => void): void {
        let len = this.dense.length;
        for (let i = 0; i < len; i++) {
            callback(this.dense[i], this.entities[i]);
        }
    }

    /**
     * 获取组件总数 也就是实体数量
     * @internal
     */
    public get size(): number {
        return this.dense.length;
    }

    /**
     * 清理所有内容
     * @internal
     */
    public dispose(): void {
        this.dense = [];
        this.entities = [];
        this.sparse.clear();
    }

    /**
     * 获取包含此组件的所有实体
     */
    public getEntities(): Entity[] {
        return this.entities;
    }

    /**
     * 获取所有组件
     */
    public getComponents(): T[] {
        return this.dense;
    }

    // /**
    //  * 实现迭代器接口，支持for...of循环
    //  * @internal
    //  */
    // public *[Symbol.iterator](): Iterator<[Entity, T]> {
    //     for (let i = 0; i < this.dense.length; i++) {
    //         yield [this.entities[i], this.dense[i]];
    //     }
    // }

    // /**
    //  * 仅迭代组件
    //  * @internal
    //  */
    // public *values(): IterableIterator<T> {
    //     for (const component of this.dense) {
    //         yield component;
    //     }
    // }

    // /**
    //  * 仅迭代实体ID
    //  * @internal
    //  */
    // public *keys(): IterableIterator<Entity> {
    //     for (const entity of this.entities) {
    //         yield entity;
    //     }
    // }
} 