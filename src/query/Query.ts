/**
 * @Author: Gongxh
 * @Date: 2025-05-15
 * @Description: 查询结果迭代器
 */

import { Component } from "../component/Component";
import { ComponentPool } from "../component/ComponentPool";
import { ComponentType } from "../component/ComponentType";
import { IComponent } from "../component/IComponent";
import { Entity } from "../entity/Entity";
import { EntityPool } from "../entity/EntityPool";
import { createMask, IMask } from "../utils/IMask";

export class Query {
    /**
     * 实体池引用
     * @internal
     */
    private entityPool: EntityPool;

    /** 
     * 组件池引用
     * @internal
     */
    private componentPool: ComponentPool;

    /**
     * 必须包含的组件掩码
     * @internal
     */
    private _includeMask: IMask;
    /**
     * 必须排除的组件掩码
     * @internal
     */
    private _excludeMask: IMask;

    /** 
     * 必须包含的数组
     * @internal
     */
    private includeComponents: number[] = [];

    /** 
     * 必须排除的数组
     * @internal
     */
    private excludeComponents: number[] = [];

    /** 
     * 可选组件包含的数组
     * @internal
     */
    private optionalComponents: number[] = [];

    /**
     * 缓存上次查询的结果, 避免每帧重新计算
     * @internal
     */
    private cachedEntities: Entity[] = [];

    /** 
     * 按实体顺序缓存组件
     */
    private cachedComponents: Map<number, IComponent[]> = new Map();

    /**
     * 脏标记
     * @internal
     */
    private _dirty: boolean = true;

    /**
     * 设置脏标记
     */
    public setDirty(): void {
        this._dirty = true;
    }

    constructor(componentPool: ComponentPool, entityPool: EntityPool, includeComponents: number[], excludeComponents: number[], optionalComponents: number[]) {
        this.componentPool = componentPool;
        this.entityPool = entityPool;

        this.includeComponents = includeComponents;
        this.excludeComponents = excludeComponents;
        this.optionalComponents = optionalComponents;

        this._includeMask = createMask();
        this._excludeMask = createMask();

        let len = includeComponents.length;
        for (let i = 0; i < len; i++) {
            this._includeMask.set(includeComponents[i]);
            this.cachedComponents.set(includeComponents[i], []);
        }

        len = excludeComponents.length;
        for (let i = 0; i < len; i++) {
            this._excludeMask.set(excludeComponents[i]);
        }

        len = optionalComponents.length;
        for (let i = 0; i < len; i++) {
            this.cachedComponents.set(optionalComponents[i], []);
        }
    }

    /**
     * 迭代满足条件的实体
     * @returns 满足条件的实体
     */
    public entities(): Entity[] {
        if (this._dirty) {
            this.refreshCache();
        }
        return this.cachedEntities;
    }

    public components<T extends Component>(comp: ComponentType<T>): T[] {
        if (this._dirty) {
            this.refreshCache();
            this._dirty = false;
        }
        return this.cachedComponents.get(comp.ctype) as T[];
    }

    // /**
    //  * 获取特定实体的特定组件
    //  * @param entity 实体
    //  * @param comp 组件类型
    //  * @returns 组件
    //  */
    // public getComponent<T extends IComponent>(entity: Entity, comp: ComponentType<T>): T | null {
    //     return this.entityPool.getComponent<T>(entity, comp);
    // }

    // /**
    //  * 同时获取多个组件（避免多次查找）
    //  * @param entity 实体
    //  * @param comps 组件类型数组
    //  * @returns 组件
    //  */
    // public getComponents(entity: Entity, ...comps: ComponentType<IComponent>[]): IComponent[] {
    //     let components: IComponent[] = new Array(comps.length);
    //     for (let i = 0; i < comps.length; i++) {
    //         components[i] = this.getComponent(entity, comps[i]) || null;
    //     }
    //     return components;
    // }

    // /**
    //  * 组件直接访问（适用于组件查询模式）
    //  * @param componentType 组件类型
    //  * @param callback 回调函数
    //  */
    // public iterate<T extends IComponent>(componentType: number, callback: (component: T, entity: Entity) => void): void {
    //     if (this._dirty) {
    //         this.refreshCache();
    //     }

    //     // 直接在内部处理，避免外部迭代
    //     const entities = this.cachedEntities;
    //     const len = entities.length;

    //     for (let i = 0; i < len; i++) {
    //         const entity = entities[i];
    //         const component = this.componentPool.getComponent(entity, componentType);
    //         if (component) {
    //             callback(component as T, entity);
    //         }
    //     }
    // }

    // /**
    //  * 实体迭代方式 - 高效批量处理
    //  * @param callback 回调函数
    //  */
    // public each(callback: (entity: Entity) => void): void {
    //     if (this._dirty) {
    //         this.refreshCache();
    //     }
    //     const entities = this.cachedEntities;
    //     const len = entities.length;
    //     for (let i = 0; i < len; i++) {
    //         callback(entities[i]);
    //     }
    // }

    // 重新计算缓存
    private refreshCache(): void {
        // 如果没有必须条件 直接返回
        if (this._includeMask.isEmpty()) {
            this.trimCache(0);
            return;
        }
        let componentPool = this.componentPool;

        // 找出必须包含的组件类型对应的实体最少的组件
        let smallestComponentType: number = -1;
        let smallestSize: number = Infinity;
        let len = this.includeComponents.length;
        for (let i = 0; i < len; i++) {
            let typeId = this.includeComponents[i];
            let size = componentPool.getEntityCount(typeId);
            if (size > 0 && size < smallestSize) {
                smallestSize = size;
                smallestComponentType = typeId;
            }
        }

        // 如果没有找到任何必需组件，直接返回
        if (smallestComponentType === -1) {
            this.trimCache(0);
            return;
        }
        // 2. 从最小集合开始筛选 - 避免全量扫描
        const entities = componentPool.getEntitiesByComponentType(smallestComponentType);

        // 3. 预分配足够空间，避免动态扩容
        len = entities.length;
        this.cachedEntities.length = len;
        this.cachedComponents.forEach((components) => {
            components.length = len;
        });

        let total = 0;
        // 4. 高效遍历和筛选
        for (let i = 0; i < len; i++) {
            const entity = entities[i];
            const entityMask = this.entityPool.getMask(entity);
            // 一次性检查所有条件，减少分支预测失败
            if (entityMask.include(this._includeMask) && !entityMask.any(this._excludeMask)) {
                this.cachedEntities[total] = entity;
                // 批量获取必须组件
                componentPool.getComponentBatch(entity, this.includeComponents, this.cachedComponents, total);
                // 批量获取可选组件
                componentPool.getComponentBatch(entity, this.optionalComponents, this.cachedComponents, total);
                total++;
            }
        }
        // 如果结果数量小于预分配空间，裁剪数组
        this.trimCache(total);
    }

    /**
     * 截取缓存数组长度
     */
    private trimCache(length: number): void {
        this.cachedEntities.length = length;
        this.cachedComponents.forEach((components) => {
            components.length = length;
        });
    }


    public clearCache(): void {
        this.cachedEntities.length = 0;
        this.cachedComponents.forEach((components) => {
            components.length = 0;
        });
    }
}