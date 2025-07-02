<?php
/**
 * WooCommerce Deposits Block Product Editor Compatibility.
 *
 * @package woocommerce-deposits
 */

use Automattic\WooCommerce\Utilities\FeaturesUtil;
use Automattic\WooCommerce\Admin\Features\ProductBlockEditor\BlockRegistry;
use Automattic\WooCommerce\Admin\Features\ProductBlockEditor\ProductTemplates\GroupInterface;
use Automattic\WooCommerce\Internal\Admin\Features\ProductBlockEditor\ProductTemplates\Group;
use Automattic\WooCommerce\Internal\Admin\Features\ProductBlockEditor\ProductTemplates\SimpleProductTemplate;
use Automattic\WooCommerce\Internal\Admin\Features\ProductBlockEditor\ProductTemplates\ProductVariationTemplate;
use Automattic\WooCommerce\Admin\Features\ProductBlockEditor\ProductTemplates\ProductFormTemplateInterface;

/**
 * Class WC_Deposits_Product_Block_Editor_Compatibility
 * Adds compatibility support for the new block product editor.
 *
 * @since 2.2.6
 */
class WC_Deposits_Product_Block_Editor_Compatibility {
	/**
	 * Constructor
	 */
	public function __construct() {
		if ( ! FeaturesUtil::feature_is_enabled( 'product_block_editor' ) ) {
			return;
		}

		add_action(
			'init',
			array( $this, 'register_custom_blocks' )
		);

		add_action(
			'woocommerce_block_template_area_product-form_after_add_block_general',
			array( $this, 'add_deposits_section' )
		);
	}

	/**
	 * Registers the custom product field blocks.
	 */
	public function register_custom_blocks() {
		if ( isset( $_GET['page'] ) && 'wc-admin' === $_GET['page'] ) { // phpcs:ignore WordPress.Security.NonceVerification.Recommended
			BlockRegistry::get_instance()->register_block_type_from_metadata( WC_DEPOSITS_ABSPATH . 'build/admin/blocks/select-control' );
		}
	}

	/**
	 * Adds a Depostis section to the product editor under the 'General' group.
	 *
	 * @since 2.2.6
	 *
	 * @param Group $variation_group The group instance.
	 */
	public function add_deposits_section( $variation_group ) {
		$template             = $variation_group->get_root_template();
		$is_simple_product    = $this->is_template_valid( $template, 'simple-product' );
		$is_variation_product = $this->is_template_valid( $template, 'product-variation' );

		if ( ! ( $is_simple_product || $is_variation_product ) ) {
			return;
		}

		if ( ! $variation_group instanceof GroupInterface ) {
			return;
		}

		/**
		 * Template instance.
		 *
		 * @var ProductFormTemplateInterface $parent
		 */
		$parent = $variation_group->get_parent();
		$group  = $parent->add_group(
			array(
				'id'         => 'woocommerce-deposits-group-tab',
				'attributes' => array(
					'title' => __( 'Deposits', 'woocommerce-deposits' ),
				),
			)
		);

		$product_type = $is_simple_product ? 'simple' : 'variation';

		$section = $group->add_section(
			array(
				'id'         => 'woo-deposits-section',
				'attributes' => array(
					'title' => __( 'Deposits', 'woocommerce-deposits' ),
				),
			)
		);

		$section->add_block(
			array(
				'id'         => 'wc_deposit_enabled',
				'blockName'  => 'woocommerce-deposits/select-control-block',
				'attributes' => array(
					'title'    => __( 'Enable deposits', 'woocommerce-deposits' ),
					'help'     => sprintf(
						/* translators: %s URL for Woo Deposits settings page.  */
						__( 'Allow customers to pay a deposit for this product. <a href="%s" target="_blank">Manage storewide settings</a>', 'woocommerce-deposits' ),
						admin_url( 'admin.php?page=wc-settings&tab=products&section=deposits' )
					),
					'property' => 'meta_data._wc_deposit_enabled',
					'options'  => array(
						array(
							'label' => WC_Deposits_Product_Manager::get_setting_inheritance_label( 'enabled', $product_type ),
							'value' => '',
						),
						array(
							'label' => __( 'Yes - deposits are optional', 'woocommerce-deposits' ),
							'value' => 'optional',
						),
						array(
							'label' => __( 'Yes - deposits are required', 'woocommerce-deposits' ),
							'value' => 'forced',
						),
						array(
							'label' => __( 'No', 'woocommerce-deposits' ),
							'value' => 'no',
						),
					),
				),
			)
		);

		$section->add_block(
			array(
				'id'             => 'wc_deposit_type',
				'blockName'      => 'woocommerce-deposits/select-control-block',
				'attributes'     => array(
					'title'    => __( 'Deposit Type', 'woocommerce-deposits' ),
					'help'     => __( 'Choose how customers can pay for this product using a deposit.', 'woocommerce-deposits' ),
					'property' => 'meta_data._wc_deposit_type',
					'options'  => array(
						array(
							'label' => WC_Deposits_Product_Manager::get_setting_inheritance_label( 'deposit_type', $product_type ),
							'value' => '',
						),
						array(
							'label' => __( 'Percentage', 'woocommerce-deposits' ),
							'value' => 'percent',
						),
						array(
							'label' => __( 'Fixed Amount', 'woocommerce-deposits' ),
							'value' => 'fixed',
						),
						array(
							'label' => __( 'Payment Plan', 'woocommerce-deposits' ),
							'value' => 'plan',
						),
					),
				),
				'hideConditions' => array(
					array(
						'expression' => '"no" === editedProduct.meta_data._wc_deposit_enabled',
					),
				),
			)
		);

		$section->add_block(
			array(
				'id'             => 'wc_deposit_amount',
				'blockName'      => 'woocommerce/product-pricing-field',
				'attributes'     => array(
					'title'    => __( 'Deposit Amount', 'woocommerce-deposits' ),
					'help'     => __( 'The amount of deposit needed. Do not include the currency symbol.', 'woocommerce-deposits' ),
					'property' => 'meta_data._wc_deposit_amount',
				),
				'hideConditions' => array(
					array(
						'expression' => '"fixed" !== editedProduct.meta_data._wc_deposit_type || "no" === editedProduct.meta_data._wc_deposit_enabled',
					),
				),
			)
		);

		$section->add_block(
			array(
				'id'             => 'wc_deposit_amount_percentage',
				'blockName'      => 'woocommerce/product-number-field',
				'attributes'     => array(
					'label'    => __( 'Deposit Amount (%)', 'woocommerce-deposits' ),
					'property' => 'meta_data._wc_deposit_amount',
					'help'     => __( 'The amount of deposit needed. Do not include the percent symbol.', 'woocommerce-deposits' ),
					'min'      => 0,
					'max'      => 100,
					'step'     => 1,
				),
				'hideConditions' => array(
					array(
						'expression' => '"percent" !== editedProduct.meta_data._wc_deposit_type || "no" === editedProduct.meta_data._wc_deposit_enabled',
					),
				),
			)
		);

		$payment_plans        = WC_Deposits_Plans_Manager::get_plan_ids();
		$payment_plan_options = array();

		foreach ( $payment_plans as $value => $label ) {
			$payment_plan_options[] = array(
				'label' => $label,
				'value' => $value,
			);
		}

		$section->add_block(
			array(
				'id'             => 'wc_deposit_payment_plan',
				'blockName'      => 'woocommerce-deposits/select-control-block',
				'attributes'     => array(
					'title'    => __( 'Payment Plans', 'woocommerce-deposits' ),
					'help'     => __( 'Choose which payment plans customers can use for this product.', 'woocommerce-deposits' ),
					'property' => 'meta_data._wc_deposit_payment_plans',
					'options'  => $payment_plan_options,
					'multiple' => true,
				),
				'hideConditions' => array(
					array(
						'expression' => '"plan" !== editedProduct.meta_data._wc_deposit_type || "no" === editedProduct.meta_data._wc_deposit_enabled',
					),
				),
			)
		);

		$section->add_block(
			array(
				'id'         => 'wc_deposit_selected_type',
				'blockName'  => 'woocommerce-deposits/select-control-block',
				'attributes' => array(
					'title'    => __( 'Default Deposit Selected Type', 'woocommerce-deposits' ),
					'help'     => __( 'Choose the default selected type of payment on page load.', 'woocommerce-deposits' ),
					'property' => 'meta_data._wc_deposit_selected_type',
					'options'  => array(
						array(
							'label' => WC_Deposits_Product_Manager::get_setting_inheritance_label( 'deposit_selected_type', $product_type ),
							'value' => '',
						),
						array(
							'label' => __( 'Pay Deposit', 'woocommerce-deposits' ),
							'value' => 'deposit',
						),
						array(
							'label' => __( 'Pay in Full', 'woocommerce-deposits' ),
							'value' => 'full',
						),
					),
				),
			)
		);
	}

	/**
	 * Returns true if the template is valid.
	 *
	 * @param SimpleProductTemplate|ProductVariationTemplate $template    The template object.
	 * @param string                                         $template_id The template ID.
	 *
	 * @return bool
	 */
	private function is_template_valid( $template, $template_id ) {
		return $template_id === $template->get_id();
	}
}

new WC_Deposits_Product_Block_Editor_Compatibility();
