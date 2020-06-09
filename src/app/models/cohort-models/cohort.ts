import { Constraint } from "../constraint-models/constraint"
import { subscribeOn } from "rxjs/operators"
import { runInThisContext } from "vm"
import { rootCertificates } from "tls"
import { CombinationConstraint } from "../constraint-models/combination-constraint"


export class Cohort{
    protected _name :string
    protected _patient_set_id : Map<string,number>

    protected _selected : boolean


    protected _rootInclusionConstraint : CombinationConstraint
    protected _rootExclusionConstraint : CombinationConstraint
    constructor(name :string, rootInclusionConstraint : CombinationConstraint, rootExclusionConstraint:CombinationConstraint){
        this._name=name
        
        if (rootInclusionConstraint !=null){
            
    
            this._rootInclusionConstraint=rootInclusionConstraint.clone()
        }
        if (rootExclusionConstraint !=null){

    
            this._rootExclusionConstraint=rootExclusionConstraint.clone()
        }
        
        
        this._selected=false
    }

    get name() : string{
        return this._name
    }

    get patient_set_id():Map<string,number>{
        return new Map(this._patient_set_id)
    }

    get rootInclusionConstraint(): CombinationConstraint{
        if(this._rootInclusionConstraint){
            var cpy = new CombinationConstraint
            cpy.parentConstraint=this._rootInclusionConstraint.parentConstraint
            cpy.textRepresentation=this._rootInclusionConstraint.textRepresentation
            
            cpy.children=this._rootInclusionConstraint.children
            cpy.combinationState=this._rootInclusionConstraint.combinationState
            cpy.isRoot=this._rootInclusionConstraint.isRoot

            return cpy
        }else{
            return null
        }
        
    }

    set rootInclusionConstraint(constr : CombinationConstraint){
        if(constr){
            var cpy = new CombinationConstraint
            cpy.parentConstraint=constr.parentConstraint
            cpy.textRepresentation=constr.textRepresentation

            cpy.children=constr.children
            cpy.combinationState=constr.combinationState
            cpy.isRoot=constr.isRoot

            this._rootInclusionConstraint=cpy

        }else{
            this._rootInclusionConstraint=null
        }
        

    }

    get rootExclusionConstraint(): CombinationConstraint{
        if(this._rootExclusionConstraint){
            var cpy = new CombinationConstraint
            cpy.parentConstraint=this._rootExclusionConstraint.parentConstraint
            cpy.textRepresentation=this._rootExclusionConstraint.textRepresentation
            

            cpy.children=this._rootExclusionConstraint.children
            cpy.combinationState=this._rootExclusionConstraint.combinationState
            cpy.isRoot=this._rootExclusionConstraint.isRoot
            
            
            return cpy
        }else{
            return null
        }
        
    }

    set rootExclusionConstraint(constr : CombinationConstraint){
        if(constr){
            var cpy = new CombinationConstraint
            cpy.parentConstraint=constr.parentConstraint
            cpy.textRepresentation=constr.textRepresentation

            cpy.children=constr.children
            cpy.combinationState=constr.combinationState
            cpy.isRoot=constr.isRoot

            this._rootExclusionConstraint=cpy
        }else{
            this._rootExclusionConstraint=null
        }
        

    }

    set name(n : string){
        this._name =n
    }

    set patient_set_id(psid : Map<string,number>){
        this._patient_set_id=new Map(psid)

    }

    set selected(select : boolean){
        this._selected=select
    }

    get selected() : boolean{
        return this.selected
    }

}


export class SurvivalCohort extends Cohort{

    _hasSubGroups:boolean
    _granularity: string

    _subGroups = new Array<Cohort>()
    constructor(name:string, rootInclConstraint: CombinationConstraint,rootExclConstraint:CombinationConstraint){
        super(name,rootInclConstraint,rootExclConstraint)
        this._hasSubGroups=false

    }


    set hasSubGroups(val:boolean){
        this._hasSubGroups=val
    }

    get hasSubGroups() : boolean{
        return this._hasSubGroups
    }

    get subGroups(): Array<Cohort>{
        return this._subGroups.map(function(subGroup:Cohort){
            var cpy = new Cohort(subGroup.name, subGroup.rootInclusionConstraint,subGroup.rootExclusionConstraint)
            return cpy
        })

    }

    set subGroups(subGroups: Array <Cohort>){
        this._subGroups=new Array<Cohort>()
        subGroups.forEach(function(subGroup:Cohort){
            var cpy = new Cohort(subGroup.name, subGroup.rootInclusionConstraint,subGroup.rootExclusionConstraint)
            this._subGroups.push(cpy)
        })
    }


}