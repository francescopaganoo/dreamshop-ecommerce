<?php
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

class WCABM_Migrator {
    protected $source_taxonomy;
    protected $target_taxonomy;

    public function __construct( $source_taxonomy, $target_taxonomy ) {
        $this->source_taxonomy = $source_taxonomy;
        $this->target_taxonomy = $target_taxonomy;
    }

    /**
     * Esegue la migrazione completa.
     *
     * @return array{terms:int,products:int}
     */
    public function run( $limit = 0 ) {
        if ( ! taxonomy_exists( $this->source_taxonomy ) ) {
            return [ 'terms' => 0, 'products' => 0 ];
        }

        if ( ! taxonomy_exists( $this->target_taxonomy ) ) {
            // Non possiamo creare termini se la taxonomy non esiste.
            return [ 'terms' => 0, 'products' => 0 ];
        }

        $terms_created_or_updated = $this->migrate_terms();
        $products_updated         = $this->migrate_products_assignments( $limit );

        return [ 'terms' => $terms_created_or_updated, 'products' => $products_updated ];
    }

    /**
     * Copia tutti i termini dell'attributo sorgente verso la taxonomy target.
     * Crea i termini mancanti, mantenendo slug e descrizione. Copia l'eventuale thumbnail_id.
     */
    protected function migrate_terms() {
        $count = 0;
        $source_terms = get_terms([
            'taxonomy'   => $this->source_taxonomy,
            'hide_empty' => false,
        ]);

        if ( is_wp_error( $source_terms ) || empty( $source_terms ) ) {
            return 0;
        }

        foreach ( $source_terms as $term ) {
            $target = get_term_by( 'slug', $term->slug, $this->target_taxonomy );
            if ( ! $target ) {
                $res = wp_insert_term( $term->name, $this->target_taxonomy, [
                    'slug'        => $term->slug,
                    'description' => $term->description,
                ] );
                if ( is_wp_error( $res ) ) {
                    continue;
                }
                $target_term_id = (int) $res['term_id'];
                $count++;
            } else {
                // Aggiorna descrizione se diversa.
                if ( (string) $target->description !== (string) $term->description ) {
                    wp_update_term( $target->term_id, $this->target_taxonomy, [ 'description' => $term->description ] );
                }
                $target_term_id = (int) $target->term_id;
                $count++;
            }

            // Copia immagine se presente (usa convenzione thumbnail_id)
            $thumb = get_term_meta( $term->term_id, 'thumbnail_id', true );
            if ( $thumb ) {
                update_term_meta( $target_term_id, 'thumbnail_id', $thumb );
            }
        }

        return $count;
    }

    /**
     * Assegna ai prodotti i termini marchio corrispondenti ai termini dell'attributo brand.
     */
    protected function migrate_products_assignments( $limit = 0 ) {
        $updated = 0;

        $q = new WP_Query([
            'post_type'      => 'product',
            'post_status'    => 'any',
            'fields'         => 'ids',
            'posts_per_page' => ( $limit && $limit > 0 ) ? (int) $limit : -1,
            'no_found_rows'  => true,
        ]);

        if ( empty( $q->posts ) ) {
            return 0;
        }

        foreach ( $q->posts as $product_id ) {
            $src_terms = wp_get_object_terms( $product_id, $this->source_taxonomy );
            if ( is_wp_error( $src_terms ) || empty( $src_terms ) ) {
                continue;
            }

            $target_ids = [];
            foreach ( $src_terms as $t ) {
                $target = get_term_by( 'slug', $t->slug, $this->target_taxonomy );
                if ( $target && ! is_wp_error( $target ) ) {
                    $target_ids[] = (int) $target->term_id;
                }
            }

            if ( ! empty( $target_ids ) ) {
                // Append senza rimuovere eventuali termini marchio esistenti.
                $res = wp_set_object_terms( $product_id, $target_ids, $this->target_taxonomy, true );
                if ( ! is_wp_error( $res ) ) {
                    $updated++;
                }
            }
        }

        return $updated;
    }
}
