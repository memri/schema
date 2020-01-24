import pydgraph
import pandas as pd
import json
from typing import List, Tuple

ANCH_ENTS = "anchor_nodes"
UID = "uid"
TYPE_PROPERTY = "is_type"
SPECIAL_EDGES = ['name', TYPE_PROPERTY]
PROPERTY_TYPES = ['str']
TYPE_POSTFIX = " type"
SUBTYPE_PRED = "subtype"
INSTANCE_PRED = "instance"
VOWELS = ["a", "e", "i", "u", "y", "o"]

def format_pred_quad(p): return f"{p}: [uid] @reverse ."
def format_prop_quad(p, type_, indexes): return f"{p}: {type_} {indexes} ."
def combine_quads(qs): return "\n".join(qs)


class MemriDgraphClient(object):
    def __init__(self, client):
        self.client = client
        self.name_uid_pairs = None
        self.n2u_cache = {}

    # Schema
    def add_schema(self, s):
        op = pydgraph.Operation(schema=s)
        self.client.alter(op)

    def add_schema_from_properties_and_predicates(self, preds, props):
        preds = [format_pred_quad(p) for p in preds]
        props = [format_prop_quad(p, type_, f"@index({','.join(indices)})" if indices else '')
                 for (p, type_, indices) in props]
        self.add_schema(combine_quads(props + preds))

    def schema_df(self):
        return pd.DataFrame(self.run_query("schema {}")['schema']).sort_values("type").reset_index(drop=True)

    def type_df(self):
        return pd.DataFrame(self.names_from_uids(self.all_types()), columns=["type"])

    def add_types(self, types: List[Tuple[str, List[str]]], type_postfix=TYPE_POSTFIX):
        for type_name, aliases in types:
            self.add_types(type_name, aliases, type_postfix)

    def add_type(self, type_name, aliases, type_postfix=TYPE_POSTFIX):
            self.run_mutation_quads(f"""_:x <{TYPE_PROPERTY}> "{type_name}" .
                                        _:x <name> "{type_name}{type_postfix}" .""")
            self.add_aliases(type_name + type_postfix, aliases)

    def add_subtype_from_name(self, type1, type2, add_type_postfix=True):
        if add_type_postfix:
            type1 += TYPE_POSTFIX
            type2 += TYPE_POSTFIX
        self.create_edge_from_names(type1, SUBTYPE_PRED, type2)

    # Transactions (DB interactions)
    def run_query(self, query, variables=None, parse_json=True):
        txn = self.client.txn()
        try:
            res = txn.query(query, variables)
            return json.loads(res.json) if parse_json else res
        finally:
            txn.discard()

    def run_mutation_delete(self, uids):
        del_obj = [{"uid": uid, "name": self.name_from_uid(uid)} for uid in uids]
        txn = self.client.txn()
        try:
            txn.mutate(del_obj=del_obj)
            txn.commit()
        except Exception as e:
            raise e
        finally:
            txn.discard()

    def run_mutation_quads(self, obj):
        txn = self.client.txn()
        try:
            mut_res = txn.mutate(set_nquads=obj)
            txn.commit()
        except Exception as e:
            raise e
        finally:
            txn.discard()
        return mut_res

    def add_aliases(self, name, aliases, from_name=True):
        assert from_name
        for a in aliases: self.create_prop(self.uid_from_name(name), 'aliases', a)

    # Queries
    def drop_all(self):
        op = pydgraph.Operation(drop_all=True)
        self.client.alter(op)

    def drop_all_nodes(self, types=False):
        uids = self.all_entities(types)
        if len(uids) > 0:
            self.run_mutation_delete(uids)

    # Get all
    def all_entities(self, type_entities=True):
        query = """{total (func: has (name) ) {uid}}"""
        all_uids = [e['uid'] for e in self.run_query(query)['total']]
        if not type_entities:
            t_uids = self.all_types()
            return list(set(all_uids) - set(t_uids))
        else:
            return all_uids

    def all_types(self):
        query = f"""{{total (func: has ({TYPE_PROPERTY}) ) {{uid}} }}"""
        return [e['uid'] for e in self.run_query(query)['total']]

    def all_predicates(self):
        edges = self.run_query("schema {}")['schema']
        pred_edges = [e for e in edges if e['type'] == UID]
        preds = [p["predicate"] for p in pred_edges]
        inv_preds = ["~" + p["predicate"] for p in pred_edges if p.get("reverse", None)]
        return preds + inv_preds

    def all_properties(self):
        edges = self.run_query("schema {}")['schema']
        return [e['predicate'] for e in edges if e['type'] != 'uid' and e['predicate'] not in SPECIAL_EDGES]

    # Create
    def create_edge(self, uid1, pred, uid2, add_inverse=False):
        self.run_mutation_quads(f'<{uid1}> <{pred}> <{uid2}> .')
        if add_inverse:
            self.run_mutation_quads(f'<{uid2}> <{pred}> <{uid1}> .')

    def create_prop(self, uid, prop, val):
        self.run_mutation_quads(f'<{uid}> <{prop}> \"{val}\" .')

    def create_edge_from_names(self, name1, pred, name2, add_inverse=False):
        uid1, uid2 = self.uid_from_name(name1), self.uid_from_name(name2)
        self.create_edge(uid1, pred, uid2, add_inverse)

    def create_prop_from_name(self, name, prop, value):
        uid = self.get_uid_from_prop(prop="name", val=name)
        self.create_prop(uid, prop, value)

    def create_instance_from_type(self, inst_name, type_, skip_exists=False):
        t_uid = self.get_uid_from_prop(prop=TYPE_PROPERTY, val=type_)
        if not self.uid_from_name(inst_name, allow_not_exists=True):
            self.create_instance_from_type_uid(inst_name, t_uid)
        else:
            if skip_exists:
                return
            else:
                raise ValueError(f"instance with {inst_name} and type {type_} already exists")

    def create_instance_from_name(self, parent_name, inst_name):
        t_uid = self.get_uid_from_prop(prop="name", val=parent_name)
        return self.create_instance_from_type_uid(inst_name, t_uid)

    def create_instance_from_type_uid(self, inst_name, t_uid):
        result = self.run_mutation_quads(f"""_:x    <name> \"{inst_name}\" .
                                             _:x <{INSTANCE_PRED}> <{t_uid}>             . """)
        uid = result.uids['x']
        return uid

    def create_entity_with_name(self, ent_name):
        self.run_mutation_quads(f"""_:x <name> \"{ent_name}\" . """)

    def link_by_instance(self, subj, pred, par_obj, idx=1):
        """subj, pred & par_obj are names"""
        inst = f"{par_obj}_instance_{idx}"
        uid = self.create_instance_from_name(parent_name=par_obj, inst_name=inst)
        self.create_edge_from_names(subj, pred, inst)
        return uid

    def get_instances_from_typename(self, type_name):
        uid = self.uid_from_name(type_name)
        subtypes = self.subtypes_from_uid(uid)
        return self.traverse(subtypes, f"~{INSTANCE_PRED}")

    def get_instances_from_uids(self, uids):
        subtypes = list(set().union(*[self.subtypes_from_uid(uid) for uid in uids]))
        return self.traverse(subtypes, f"~{INSTANCE_PRED}")

    def get_uid_from_prop(self, prop, val, allow_not_exists=False):
        q = f"""{{ 
                  uid_by_name(func: eq({prop}, \"{val}\")) {{
                    uid
                  }}
                }}"""
        res = self.run_query(q)
        n_result = len(res["uid_by_name"])
        if n_result != 1 and not allow_not_exists:
            raise ValueError(f"WARNING: {n_result} entities with name {val}")
        elif n_result != 1:
            return None
        uid = res["uid_by_name"][0][UID]
        return uid

    def get_image_info(self, uid_or_name):
        if uid_or_name.startswith("0x"):
            name = self.name_from_uid(uid_or_name)
        else:
            name = uid_or_name
        q = f"""{{{ANCH_ENTS} (func: has(name)) @filter(eq(name,"{name}")) {{
                  name
                  uid
                  from{{
                    uid
                    name
                    {INSTANCE_PRED} {{
                      uid
                      name
                    }}
                  }}
                  contains{{
                    uid
                    name
                    {INSTANCE_PRED} {{
                      uid
                      name
                      {INSTANCE_PRED} {{
                        uid
                        name
                      }}
                    }}
                  }}
                }}
              }}"""
        res = self.run_query(q)[ANCH_ENTS][0]
        return res

    def anchor(self, ents: List[str]):
        """Returns a query pattern that anchors the query with a nodes uid"""
        return f"{ANCH_ENTS}(func: uid( {', '.join(ents)} ))"

    def traverse(self, ents: List[str], pred: str):
        q = f"""{{
                  {self.anchor(ents)} {{
                    {pred} {{
                      {UID}
                    }}
                  }}
                }}"""
        res = self.run_query(q)[ANCH_ENTS]
        result_uids = [obj[UID] for sub in res for obj in sub[pred]]
        return result_uids

    def exists(self, ent):
        res = self.run_query(f"""{{
                                   exists(func: uid(<{ent}>)) {{
                                     uid
                                   }}
                                 }}""")['exists']
        return True if res else False

    def get_property(self, ents: List[str], prop: str) -> List[str]:
        q = f"""{{
                  {self.anchor(ents)} {{
                    {UID}
                    {prop}
                  }}
                }}"""
        res = self.run_query(q)[ANCH_ENTS]
        prop_vals = [ent[prop] if prop in ent else None for ent in res]    
        return prop_vals

    def filter_has_relation_with(self, ents: List[str], pred: str, objs: List[str],
                                 instance: bool = False, all: bool = False):
        if len(ents) == 0:
            return []
        if len(objs) == 1:
            return self.filter_has_relation_with_one(ents, pred, objs[0], instance)
        else:
            ents_per_obj = [self.filter_has_relation_with_one(ents, pred, targ_obj, instance) for targ_obj in objs]
            if all:
                return list(set.intersection(*[set(item) for item in ents_per_obj]))
            else:
                return list(set([item for sublist in ents_per_obj for item in sublist]))

    def filter_has_relation_with_one(self, ents: List[str], pred: str, obj: str, instance: bool):
        ent_names = ",".join(['"' + e + '"' for e in self.get_property(ents, "name")])
        
        if instance:
            obj_subtype_uids = ",".join(self.subtypes_from_uid(obj))
            filter = f"""{pred} {{ 
                           uid
                           {INSTANCE_PRED} @filter(uid({obj_subtype_uids})) {{
                             uid
                            }}
                          }}"""
        else:
            filter = f"""{pred} @filter(uid({obj})) {{ 
                           uid
                         }}"""
        q = f"""{{{ANCH_ENTS} (func: has(name)) @filter(eq(name, [{ent_names}])) @cascade {{
                    uid
                    {filter}
                  }}
                }}"""
        return [r[UID] for r in self.run_query(q)[ANCH_ENTS]]

    def stack(self, entities, by, pred):
        ent_str, by_str = ",".join(entities), ",".join(by)

        q = f"""{{{ANCH_ENTS} (func: uid({by_str}))
                    {{
                        uid
                        name
                        {pred} @filter(uid({ent_str})){{
                                uid
                            }}
                    }}
                }}"""
        return self.run_query(q)[ANCH_ENTS]

    def name_from_uid(self, uid):
        return self.names_from_uids([uid])[0]

    def uids_from_names(self, names):
        return [self.uid_from_name(n) for n in names]

    def uid_from_name(self, name, allow_not_exists=False):
        if name in self.n2u_cache:
            return self.n2u_cache[name]
        uid = self.get_uid_from_prop(prop="name", val=name, allow_not_exists=allow_not_exists)
        if uid is not None: self.n2u_cache[name] = uid
        return uid

    def names_from_uids(self, uids: List[str]):
        q = f"""{{
          {self.anchor(uids)} {{
            name
          }}
         }}"""
        res = self.run_query(q)[ANCH_ENTS]
        result_uids = [ent["name"] for ent in res]
        return result_uids

    def filter_by_prop_val(self, ents: List[str], prop: str, val: str) -> List[str]:
        prop_vals = self.get_property(ents, prop)
        return [e for e, v in zip(ents, prop_vals) if v == val]

    def replace_names_in_query(self, logical_form: str):
        if self.name_uid_pairs is None:
            self.name_uid_pairs = [(e['uid'], self.name_from_uid(e['uid']))
                                   for e in self.run_query("""{x (func: has (name) ) {uid}}""")['x']]
        for uid, name in self.name_uid_pairs:
            logical_form = logical_form.replace(name, uid)
        return logical_form

    def replace_uids_in_query(self, logical_form: str):
        if self.name_uid_pairs is None:
            self.name_uid_pairs = [(e['uid'], self.name_from_uid(e['uid']))
                                   for e in self.run_query("""{x (func: has (name) ) {uid}}""")['x']]
        for uid, name in sorted(self.name_uid_pairs, key=lambda x: x[0], reverse=True):
            logical_form = logical_form.replace(uid, name)
        return logical_form

    @classmethod
    def from_ip(cls, ip):
        client_stub = pydgraph.DgraphClientStub(ip)
        client = pydgraph.DgraphClient(client_stub)
        return cls(client)

    def subtypes_from_type(self, type_, unpack=True, add_name=False):
        #NOTE THAT TYPE IS HERE THE TYPE PROPERTY, NOT THE NAME
        t_uid = self.get_uid_from_prop(prop=TYPE_PROPERTY, val=type_)
        return self.subtypes_from_uid(t_uid, unpack=unpack, add_name=add_name)

    def subtypes_from_uid(self, t_uid, include_self=True, unpack=True, add_name=False):
        name_str = "" if not add_name else "name"
        q = f"""{{{ANCH_ENTS} (func: uid({t_uid})) @recurse(depth: 100, loop: true) {{
                            uid
                            {name_str}
                            ~{SUBTYPE_PRED}
                    }}
                }}
             """
        res = self.run_query(q)[ANCH_ENTS]
        if unpack:
            res = unpack_recursion(res, pred=f"~{SUBTYPE_PRED}")
            if not include_self: res.remove(t_uid)
        return res

    def supertypes_from_type(self, type_):
        #NOTE THAT TYPE IS HERE THE TYPE PROPERTY, NOT THE NAME
        t_uid = self.get_uid_from_prop(prop=TYPE_PROPERTY, val=type_)
        return self.supertypes_from_uid(t_uid)

    def supertypes_from_uid(self, t_uid, include_self=True):
        q = f"""{{{ANCH_ENTS} (func: uid({t_uid})) @recurse(depth: 100, loop: true) {{
                            uid
                            {SUBTYPE_PRED}
                    }}
                }}
             """
        res = unpack_recursion(self.run_query(q)[ANCH_ENTS], pred=f"{SUBTYPE_PRED}")
        if not include_self: res.remove(t_uid)
        return res


def unpack_recursion(hierarchy, pred):
    all_types = []
    for subtype in hierarchy:
        all_types.append(subtype["uid"])
        subsubtypes = subtype.get(pred, [])
        all_types += unpack_recursion(subsubtypes, pred)
    return all_types


def uids2images(uids, remove_duplicates=False):
    names = DEFAULT_CLIENT.names_from_uids(uids)
    return MemriImageList([MemriImage(DEFAULT_CLIENT, uid, name)for uid, name in zip(uids, names)], remove_duplicates)


def str_to_list(str_, parse_nans=False):
    if parse_nans and str_ == 'nan': return []
    return str_.replace(", ", ",").split(",")


try:
    DEFAULT_CLIENT = MemriDgraphClient.from_ip('localhost:9080')
except:
    DEFAULT_CLIENT = None


class Alias(object):
    def __init__(self, alias, pluralize=True):
        self.alias = alias
        self.pluralize = pluralize
    
    def plural(self):
        if self.alias[-1] == "y":            
            if self.alias[-2] in VOWELS:
                return self.alias + "s"
            else:
                return self.alias[:-1] +"ies"
        else:
            return self.alias +"s"
        
    def aliases(self):
        if self.pluralize: return [self.alias, self.plural()]
        else:              return [self.alias]


def get_aliases(name, custom_aliases):
    if name in custom_aliases:
        return [a for c in custom_aliases[name] for a in  c.aliases()]
    else:
        return Alias(name).aliases()


def link_types(mc, d, custom_aliases):
    if d is None:
        return mc, [], custom_aliases
    for type_, v in d.items():
        aliases = get_aliases(type_, custom_aliases)
        mc.add_type(type_, aliases)
        mc, subtypes, custom_aliases = link_types(mc, v, custom_aliases)
        
        for s in subtypes:
            mc.add_subtype_from_name(s, type_)
    return mc, d.keys(), custom_aliases