/**
 * @Author: Gongxh
 * @Date: 2025-05-13
 * @Description: 
 */

import { Command, CommandType } from "./command/Command";
import { CommandPool } from "./command/CommandPool";
import { ComponentPool } from "./component/ComponentPool";
import { ComponentType } from "./component/ComponentType";
import { IComponent } from "./component/IComponent";
import { Entity } from "./entity/Entity";
import { EntityPool } from "./entity/EntityPool";
import { QueryBuilder } from "./query/QueryBuilder";
import { QueryPool } from "./query/QueryPool";
import { ISystem } from "./system/ISystem";
import { SystemGroup } from "./system/SystemGroup";

export class World {
    /** 世界名字 */
    public readonly name: string;
    /** 
     * 组件池
     */
    public componentPool: ComponentPool = null;
    /** 
     * 实体池
     */
    public entityPool: EntityPool = null;

    /** 
     * 缓冲池
     * @internal
     */
    private cacheCommands: Command[] = [];
    /**
     * 命令池
     * @internal
     */
    private commandPool: CommandPool = null;
    /**
     * 查询器池
     * @internal
     */
    private queryPool: QueryPool = null;
    /**
     * 根系统
     * @internal
     */
    private rootSystem: SystemGroup = null;

    /**
     * 创建一个世界
     * @param name 世界名字
     */
    constructor(name: string) {
        this.name = name;
        // 初始化根系统
        this.rootSystem = new SystemGroup("RootSystem");
        this.rootSystem.world = this;
    }

    /**
     * 添加系统
     * @param system 系统
     */
    public addSystem(system: ISystem): void {
        this.rootSystem.addSystem(system);
    }

    /** 
     * 世界初始化
     */
    public initialize(): void {
        if (this.componentPool) {
            throw new Error("World已经初始化过，请不要重复初始化");
        }
        // 初始化组件池
        this.componentPool = new ComponentPool();
        // 初始化实体池
        this.entityPool = new EntityPool(this.componentPool);
        // 初始化命令池
        this.commandPool = new CommandPool(this.entityPool);
        // 初始化查询器池
        this.queryPool = new QueryPool(this.componentPool, this.entityPool, this.commandPool);

        // 系统初始化
        this.rootSystem.init();
    }

    /** 
     * 创建实体 (实体仅包含一个ID)
     */
    public createEntity(): Entity {
        return this.entityPool.createEntity();
    }

    /** 
     * 移除实体
     * @param entity 实体
     */
    public removeEntity(entity: Entity): void {
        this.commandPool.addCommand(CommandType.RemoveAll, entity);
    }

    /** 
     * 添加组件 实际是加入缓冲池，等待帧结束时执行
     * @param entity 实体
     * @param comp 组件类型
     * @returns 组件实例
     */
    public addComponent<T extends IComponent>(entity: Entity, comp: ComponentType<T>): T {
        let component = this.componentPool.createComponent(comp);
        this.commandPool.addCommand(CommandType.Add, entity, comp, component);
        return component;
    }

    /** 
     * 移除组件 实际是加入缓冲池，等待帧结束时执行
     * @param entity 实体
     * @param comp 组件类型
     */
    public removeComponent<T extends IComponent>(entity: Entity, comp: ComponentType<T>): void {
        this.commandPool.addCommand(CommandType.RemoveOnly, entity, comp);
    }

    /** 
     * 获取组件
     * @param entity 实体
     * @param comp 组件类型
     * @returns 组件
     */
    public getComponent<T extends IComponent>(entity: Entity, comp: ComponentType<T>): T | undefined {
        return this.entityPool.getComponent(entity, comp);
    }

    /**
     * 更新世界
     * @param dt 时间间隔
     */
    public update(dt: number): void {
        // 执行缓冲池中的命令
        this.commandPool.update();
        // 更新系统
        this.rootSystem.update(dt);
    }

    /**
     * 创建查询构建器
     * @returns 查询构建器
     */
    public get QueryBuilder(): QueryBuilder {
        return new QueryBuilder(this.queryPool);
    }

    /**
     * 清理整个世界
     */
    public clear(): void {
        this.cacheCommands.length = 0;
        this.componentPool.clear();
        this.entityPool.clear();
        this.commandPool.clear();
        this.queryPool.clearCache();
        this.rootSystem.clear();
    }
}