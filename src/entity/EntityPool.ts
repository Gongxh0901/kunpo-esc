/**
 * @Author: Gongxh
 * @Date: 2025-05-16
 * @Description: 
 */

import { ComponentPool } from "../component/ComponentPool";
import { ComponentType } from "../component/ComponentType";
import { IComponent } from "../component/IComponent";
import { createMask, IMask } from "../utils/IMask";
import { RecyclePool } from "../utils/RecyclePool";
import { Entity } from "./Entity";

export class EntityPool {
    /** 
     * 实体id
     * @internal
     */
    private unique: number = 0;
    /**
     * 实体数量
     * @internal
     */
    private _size: number = 0;
    /**
     * 实体掩码 实体 -> 组件集合的掩码
     * @internal
     */
    private readonly entityMasks: Map<Entity, IMask> = new Map();

    /**
     * 实体上的组件集合 实体 -> 组件集合
     * @internal
     */
    private readonly entityComponentSet: Map<Entity, Set<number>> = new Map();
    /** 
     * 实体回收池
     * @internal
     */
    private readonly recyclePool: RecyclePool<Entity> = null;
    /** 
     * 掩码回收池
     * @internal
     */
    private readonly maskRecyclePool: RecyclePool<IMask> = null;

    /**
     * 组件池引用
     * @internal
     */
    private readonly _componentPool: ComponentPool = null;


    /**
     * 获取组件池
     * @internal
     */
    public get componentPool(): ComponentPool {
        return this._componentPool;
    }

    /** 
     * 获取有效实体数量
     * @returns 有效实体数量
     */
    public get size(): number {
        return this._size;
    }

    constructor(componentPool: ComponentPool) {
        this.unique = 0;
        this._size = 0;

        this._componentPool = componentPool;

        // 初始化实体回收池
        this.recyclePool = new RecyclePool<Entity>(() => this.unique++, null, 128, 500000);
        this.recyclePool.name = "EntityPool";
        // 实体掩码回收池
        this.maskRecyclePool = new RecyclePool<IMask>(() => createMask(), mask => mask.clear(), 128, 4096);
        this.maskRecyclePool.name = "MaskPool";
    }

    /** 
     * 创建实体 (实体仅包含一个ID)
     * @returns 实体
     * @internal
     */
    public createEntity(): Entity {
        return this.recyclePool.pop();
    }

    /**
     * 给实体添加组件
     * @param entity 实体
     * @param comp 组件类型
     * @internal
     */
    public addComponent(entity: Entity, comp: ComponentType<IComponent>, component: IComponent): void {
        if (this.hasComponent(entity, comp.ctype)) {
            console.warn(`entity[${entity}]已经拥有组件[${comp.cname}]`);
            return;
        }
        let componentType = comp.ctype;
        if (!this.entityMasks.has(entity)) {
            this.entityMasks.set(entity, this.maskRecyclePool.pop().set(componentType));
            this.entityComponentSet.set(entity, new Set<number>().add(componentType));
            this._size++;
        } else {
            this.entityMasks.get(entity).set(componentType);
            this.entityComponentSet.get(entity).add(componentType);
        }
        this._componentPool.addComponent(entity, componentType, component);
    }

    /**
     * 删除实体的组件
     * @param entity 实体
     * @param comp 组件类型
     * @returns 是否成功删除
     */
    public removeComponent(entity: Entity, comp: ComponentType<IComponent>): boolean {
        if (!this.entityMasks.has(entity)) {
            // 实体上没有组件
            console.warn(`entity[${entity}]已经被删除, 删除组件[${comp.cname}]失败`);
            return false;
        }
        // 实体上没有组件
        if (this.hasComponent(entity, comp.ctype)) {
            console.warn(`entity[${entity}]上没有组件[${comp.cname}]`);
            return false;
        }
        this._componentPool.removeComponent(entity, comp.ctype);
        // 删除组件
        let mask = this.entityMasks.get(entity);
        mask.delete(comp.ctype);
        if (mask.isEmpty()) {
            this._size--;
            // 回收掩码
            this.maskRecyclePool.insert(mask);
            // 删除实体掩码
            this.entityMasks.delete(entity);
            // 回收实体
            this.recyclePool.insert(entity);
            // 删除实体组件集合
            this.entityComponentSet.delete(entity);
        } else {
            // 更新组件集合
            this.entityComponentSet.get(entity).delete(comp.ctype);
        }
        return true;
    }


    /** 
     * 移除并回收实体id
     * @param entity 实体
     */
    public removeEntity(entity: Entity): void {
        if (!this.entityMasks.has(entity)) {
            // 实体不存在
            console.warn(`entity[${entity}]不存在 删除失败`);
            return;
        }
        this._size--;
        // 删除并回收实体掩码
        this.maskRecyclePool.insert(this.entityMasks.get(entity));
        // 回收实体id
        this.recyclePool.insert(entity);
        // 删除实体掩码
        this.entityMasks.delete(entity);
        // 删除实体上的所有组件
        let componentSet = this.entityComponentSet.get(entity);
        for (let componentType of componentSet) {
            this._componentPool.removeComponent(entity, componentType);
        }
        // 删除实体组件集合
        this.entityComponentSet.delete(entity);
    }

    /**
     * 获取实体的组件
     * @param entity 实体
     * @param comp 组件类型
     * @returns 组件
     */
    public getComponent<T extends IComponent>(entity: Entity, comp: ComponentType<T>): T {
        if (!this.hasComponent(entity, comp.ctype)) {
            console.warn(`entity[${entity}]上没有组件[${comp.cname}]`);
            return null;
        }
        return this._componentPool.getComponent(entity, comp.ctype) as T;
    }

    /**
     * 检查实体是否拥有特定组件
     * @param entity 实体
     * @param componentType 组件类型
     * @returns 是否拥有
     */
    public hasComponent(entity: Entity, componentType: number): boolean {
        return this.entityMasks.get(entity)?.has(componentType) || false;
    }

    /**
     * 获取实体的掩码
     * @param entity 实体
     * @returns 掩码
     */
    public getMask(entity: Entity): IMask {
        return this.entityMasks.get(entity);
    }

    /**
     * 获取实体上的组件集合
     * @param entity 实体
     * @returns 组件集合
     */
    public getComponents(entity: Entity): Set<number> {
        return this.entityComponentSet.get(entity) || null;
    }

    /**
     * 清理实体池
     */
    public clear(): void {
        this.unique = 0;
        this._size = 0;
        this.entityMasks.clear();
        this.entityComponentSet.clear();
        this.recyclePool.clear();
        this.maskRecyclePool.clear();
    }
}
