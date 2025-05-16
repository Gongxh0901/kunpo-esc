/**
 * @Author: Gongxh
 * @Date: 2025-05-15
 * @Description: 命令缓冲池
 */

import { ComponentType } from "../component/ComponentType";
import { IComponent } from "../component/IComponent";
import { Entity } from "../entity/Entity";
import { EntityPool } from "../entity/EntityPool";
import { Query } from "../query/Query";
import { RecyclePool } from "../utils/RecyclePool";
import { Command, CommandType } from "./Command";


export class CommandPool {
    /** 
     * 实体池的引用
     * @internal
     */
    private readonly entityPool: EntityPool;
    /** 
     * 缓冲命令池
     * @internal
     */
    private pool: Command[] = [];

    /** 
     * 缓冲命令回收池
     * @internal
     */
    private recyclePool: RecyclePool<Command> = null;

    /**
     * 查询器池的引用
     * @internal
     */
    private readonly componentTypeQuerys: Map<number, Query[]> = new Map();

    /** 
     * 变化的组件类型 
     * @internal
     */
    private _changedTypes: Set<number> = new Set();

    constructor(entityPool: EntityPool) {
        this.entityPool = entityPool;
        // 命令回收池
        this.recyclePool = new RecyclePool<Command>(() => new Command(), command => command.reset(), 64);
        this.recyclePool.name = "CommandPool";
    }

    /**
     * 注册查询器
     * @param query 查询器
     * @param includes 必须包含的组件类型
     * @param excludes 必须排除的组件类型
     */
    public registerQuery(query: Query, includes: number[], excludes: number[]) {
        let len = includes.length;
        for (let i = 0; i < len; i++) {
            let type = includes[i];
            let queries = this.componentTypeQuerys.get(type);
            if (!queries) {
                queries = [query];
                this.componentTypeQuerys.set(type, queries);
            } else {
                queries.push(query);
            }
        }

        len = excludes.length;
        for (let i = 0; i < len; i++) {
            let type = excludes[i];
            let queries = this.componentTypeQuerys.get(type);
            if (!queries) {
                queries = [query];
                this.componentTypeQuerys.set(type, queries);
            } else {
                queries.push(query);
            }
        }
    }

    /**
     * 添加命令
     * @param type 命令类型
     * @param entity 实体
     * @param comp 组件类型
     * @param component 组件
     */
    public addCommand(type: CommandType, entity: Entity, comp?: ComponentType<IComponent>, component?: IComponent) {
        this.pool.push(this.recyclePool.pop().set(type, entity, comp, component));
    }

    public update() {
        let entityPool = this.entityPool;

        let len = this.pool.length;
        for (let i = 0; i < len; i++) {
            let command = this.pool[i];
            let entity = command.entity;
            if (command.type === CommandType.Add) {
                this._changedTypes.add(command.comp.ctype);
                entityPool.addComponent(entity, command.comp, command.component);
            } else if (command.type === CommandType.RemoveOnly) {
                this._changedTypes.add(command.comp.ctype);
                entityPool.removeComponent(entity, command.comp);
            } else if (command.type === CommandType.RemoveAll) {
                entityPool.getComponents(entity)?.forEach(componentType => this._changedTypes.add(componentType));
                // 移除实体对应的所有组件 并回收实体
                entityPool.removeEntity(entity)
            }
        }
        this.pool.length = 0;

        // 标记查询器
        for (let type of this._changedTypes.values()) {
            this.modifyQueryDirtyByComponentType(type);
        }
        this._changedTypes.clear();
    }

    /**
     * 根据组件类型修改查询器脏标记
     * @param componentType 组件类型
     */
    private modifyQueryDirtyByComponentType(componentType: number) {
        let queries = this.componentTypeQuerys.get(componentType);
        if (queries) {
            let len = queries.length;
            for (let i = 0; i < len; i++) {
                queries[i].setDirty();
            }
        }
    }

    public clear() {
        this.pool = [];
        this.recyclePool.clear();
    }
}
