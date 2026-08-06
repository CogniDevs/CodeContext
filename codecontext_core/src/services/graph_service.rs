use petgraph::graph::{DiGraph, NodeIndex};
use petgraph::Direction;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct SymbolNode {
    pub name: String,
    pub file_path: String,
    pub symbol_type: String,
}

pub struct SymbolGraph {
    graph: DiGraph<SymbolNode, f64>,
    node_map: HashMap<String, NodeIndex>,
}

impl SymbolGraph {
    pub fn new() -> Self {
        Self {
            graph: DiGraph::new(),
            node_map: HashMap::new(),
        }
    }

    pub fn add_symbol(&mut self, file_path: &str, name: &str, symbol_type: &str) -> NodeIndex {
        let id = format!("{}::{}", file_path, name);
        if let Some(&idx) = self.node_map.get(&id) {
            return idx;
        }
        let node = SymbolNode {
            name: name.to_string(),
            file_path: file_path.to_string(),
            symbol_type: symbol_type.to_string(),
        };
        let idx = self.graph.add_node(node);
        self.node_map.insert(id, idx);
        idx
    }

    pub fn add_dependency(&mut self, from_id: &str, to_id: &str, weight: f64) {
        if let (Some(&from), Some(&to)) = (self.node_map.get(from_id), self.node_map.get(to_id)) {
            self.graph.add_edge(from, to, weight);
        }
    }

    pub fn calculate_pagerank(&self, damping: f64, max_iterations: usize) -> HashMap<String, f64> {
        let node_count = self.graph.node_count();
        if node_count == 0 {
            return HashMap::new();
        }

        let initial_rank = 1.0 / (node_count as f64);
        let mut ranks: HashMap<NodeIndex, f64> = self
            .graph
            .node_indices()
            .map(|node| (node, initial_rank))
            .collect();

        for _ in 0..max_iterations {
            let mut new_ranks = HashMap::new();
            for node in self.graph.node_indices() {
                let mut incoming_sum = 0.0;
                for neighbor in self.graph.neighbors_directed(node, Direction::Incoming) {
                    let out_degree = self
                        .graph
                        .neighbors_directed(neighbor, Direction::Outgoing)
                        .count();
                    if out_degree > 0 {
                        let rank_j = ranks.get(&neighbor).cloned().unwrap_or(0.0);
                        incoming_sum += rank_j / (out_degree as f64);
                    }
                }
                let rank = ((1.0 - damping) / (node_count as f64)) + (damping * incoming_sum);
                new_ranks.insert(node, rank);
            }
            ranks = new_ranks;
        }

        let mut result = HashMap::new();
        for (id, &idx) in &self.node_map {
            if let Some(&rank) = ranks.get(&idx) {
                result.insert(id.clone(), rank);
            }
        }
        result
    }
}