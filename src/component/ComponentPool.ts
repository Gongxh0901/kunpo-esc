/**
 * 组件池 - 使用稀疏集合高效管理不同类型的组件
 */
import { _ecsdecorator } from '../ECSDecorator';
import { Entity } from '../entity/Entity';
import { RecyclePool } from '../utils/RecyclePool';
import { SparseSet } from '../utils/SparseSet';
import { ComponentType } from './ComponentType';
import { IComponent } from './IComponent';

export class ComponentPool {
    /**
     * 组件类型对应的稀疏集合 组件类型 -> 稀疏集合
     * @internal
     */
    private readonly pools: Map<number, SparseSet<IComponent>> = new Map();

    /**
     * 组件回收池 组件类型 -> 回收池
     * @internal
     */
    private readonly recyclePools: Map<number, RecyclePool<IComponent>> = new Map();
    /**
     * 组件池初始化
     * @internal
     */
    constructor() {
        this.pools.clear();
        // 用注册的所有组件数据 创建稀疏集合
        let componentMaps = _ecsdecorator.getComponentMaps();
        for (let ctor of componentMaps.keys()) {
            let type = ctor.ctype;
            // 创建稀疏集合
            this.pools.set(type, new SparseSet<IComponent>());
            // 创建组件回收池
            let pool = new RecyclePool<IComponent>(() => new ctor(), component => component.reset(), 16);
            pool.name = `ComponentPool-${ctor.cname}`;
            this.recyclePools.set(type, pool);
        }
    }

    /**
     * 获取或创建特定ID的组件池
     * @param componentType 组件类型
     * @returns 对应的稀疏集合
     * @internal
     */
    private getPool<T extends IComponent>(componentType: number): SparseSet<T> {
        return this.pools.get(componentType) as SparseSet<T>;
    }

    /**
     * 创建组件
     * @param component 组件类型
     * @returns 组件实例
     * @internal
     */
    public createComponent<T extends IComponent>(component: ComponentType<T>): T {
        let type = component.ctype;
        return this.recyclePools.get(type).pop() as T;
    }

    /**
     * 添加组件到实体 (其实是预添加)
     * @param entity 实体
     * @param comp 组件类型
     * @param component 组件实例
     * @internal
     */
    public addComponent<T extends IComponent>(entity: Entity, componentType: number, component: T): void {
        // 获取对应组件池并添加组件
        this.getPool<T>(componentType).add(entity, component);
    }

    /**
     * 获取实体的组件
     * @param entity 实体
     * @param componentType 组件类型
     * @returns 组件或undefined(如不存在)
     * @internal
     */
    public getComponent<T extends IComponent>(entity: Entity, componentType: number): T | undefined {
        return (this.pools.get(componentType) as SparseSet<T>).get(entity) as T;
    }

    /**
     * 获取实体的多个组件 (专门给查询器用的)
     * @param entity 实体
     * @param componentTypes 组件类型
     * @internal
     */
    public getComponentBatch(entity: Entity, componentTypes: number[], out: Map<number, IComponent[]>, index: number): void {
        for (let type of componentTypes) {
            out.get(type)[index] = this.getComponent(entity, type);
        }
    }

    /**
     * 删除实体的特定组件
     * @param entity 实体
     * @param componentType 组件类型
     * @internal
     */
    public removeComponent(entity: Entity, componentType: number): void {
        // 从组件池中移除 并 回收组件
        this.recyclePools.get(componentType).insert(this.pools.get(componentType).remove(entity));
    }

    // 获取拥有特定组件的实体数量
    public getEntityCount(componentType: number): number {
        return this.pools.get(componentType)?.size || 0;
    }

    /** 获取拥有特定组件的实体 */
    public getEntitiesByComponentType(componentType: number): Entity[] {
        return this.pools.get(componentType)?.getEntities() || [];
    }

    /**
     * 清理组件池中所有内容
     * @internal
     */
    public clear(): void {
        this.pools.clear();
        this.recyclePools.clear();
    }

    // /**
    //  * 获取拥有特定组件的所有实体
    //  * @param componentId 组件ID
    //  * @returns 实体ID数组
    //  */
    // public getEntitiesWithComponent(componentId: number): number[] {
    //     const pool = this.pools.get(componentId);
    //     return pool ? pool.getEntityIds() : [];
    // }

    // /**
    //  * 查询同时拥有某些组件且不拥有其他组件的实体
    //  * @param withComponentIds 必须拥有的组件ID
    //  * @param withoutComponentIds 必须不拥有的组件ID
    //  * @returns 匹配的实体ID数组
    //  */
    // public query(withComponentIds: number[] = [], withoutComponentIds: number[] = []): number[] {
    //     if (withComponentIds.length === 0) {
    //         return []; // 如果没有指定必需组件，返回空数组
    //     }

    //     // 创建用于匹配的掩码
    //     const requiredMask = new Mask();
    //     const excludedMask = new Mask();

    //     for (const id of withComponentIds) {
    //         requiredMask.set(id);
    //     }

    //     for (const id of withoutComponentIds) {
    //         excludedMask.set(id);
    //     }

    //     // 找出包含实体最少的组件池，作为查询起点
    //     let smallestPool: SparseSet<any> | undefined;
    //     let smallestComponentId = -1;

    //     for (const id of withComponentIds) {
    //         const pool = this.pools.get(id);
    //         if (!pool) return []; // 如果有必需组件不存在，结果必然为空

    //         if (!smallestPool || pool.size < smallestPool.size) {
    //             smallestPool = pool;
    //             smallestComponentId = id;
    //         }
    //     }

    //     // 从最小集合开始筛选符合条件的实体
    //     const result: number[] = [];
    //     smallestPool!.forEach((_, entityId) => {
    //         const entityMask = this.entityMasks.get(entityId);
    //         if (entityMask &&
    //             entityMask.include(requiredMask) &&
    //             !entityMask.any(excludedMask)) {
    //             result.push(entityId);
    //         }
    //     });

    //     return result;
    // }

    // /**
    //  * 对所有拥有特定组件的实体执行操作
    //  * @param componentId 组件ID
    //  * @param callback 回调函数
    //  */
    // public forEachComponent<T extends IComponent>(componentId: number, callback: (component: T, entityId: number) => void): void {
    //     const pool = this.pools.get(componentId) as SparseSet<T> | undefined;
    //     if (pool) {
    //         pool.forEach(callback);
    //     }
    // }

    // /**
    //  * 执行一个系统更新，处理符合条件的实体
    //  * @param withComponentIds 必需组件ID
    //  * @param withoutComponentIds 排除组件ID
    //  * @param updateFn 更新函数
    //  */
    // public applySystem<T extends Record<number, any>>( withComponentIds: number[], withoutComponentIds: number[], updateFn: (entityId: number, components: T) => void
    // ): void {
    //     // 查询符合条件的实体
    //     const entities = this.query(withComponentIds, withoutComponentIds);

    //     // 对每个实体执行更新
    //     for (const entityId of entities) {
    //         // 收集该实体所有需要的组件
    //         const components = {} as T;
    //         for (const id of withComponentIds) {
    //             components[id] = this.getComponent(entityId, id);
    //         }

    //         // 执行更新
    //         updateFn(entityId, components);
    //     }
    // }
}