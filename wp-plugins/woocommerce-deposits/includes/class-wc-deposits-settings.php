<?php
/**
 * Deposits scheduled order manager
 *
 * @package woocommerce-deposits
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * WC_Deposits_Settings class.
 */
class WC_Deposits_Settings {

	/**
	 * Tab ID
	 *
	 * @var string
	 */
	private $settings_tab_id = 'deposits';

	/**
	 * Class instance
	 *
	 * @var WC_Deposits_Settings
	 */
	private static $instance;

	/**
	 * Get the class instance.
	 */
	public static function get_instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor.
	 */
	public function __construct() {
		// Load in the new settings tabs.
		add_action( 'woocommerce_get_sections_products', array( $this, 'add_woocommerce_settings_tab' ), 50 );
		add_action( 'woocommerce_get_settings_products', array( $this, 'get_settings' ), 50, 2 );

		add_action( 'admin_enqueue_scripts', array( $this, 'styles_and_scripts' ) );
	}

	/**
	 * Scripts.
	 */
	public function styles_and_scripts() {
		WC_Deposits::register_script( 'woocommerce-deposits-admin', 'admin' );
	}

	/**
	 * Add settings tab to woocommerce.
	 *
	 * @param array $settings_tabs Settings tabs.
	 * @return array
	 */
	public function add_woocommerce_settings_tab( $settings_tabs ) {
		$settings_tabs[ $this->settings_tab_id ] = __( 'Deposits', 'woocommerce-deposits' );
		return $settings_tabs;
	}

	/**
	 * Get the URL of the Deposits settings tab.
	 *
	 * @return string URL of the Deposits settings tab in WooCommerce settings.
	 */
	public function get_settings_tab_url(): string {
		return add_query_arg(
			array(
				'page'    => 'wc-settings',
				'tab'     => 'products',
				'section' => $this->settings_tab_id,
			),
			admin_url( 'admin.php' )
		);
	}

	/**
	 * Returns settings array.
	 *
	 * @param array  $settings Settings.
	 * @param string $current_section Section.
	 * @return array
	 */
	public function get_settings( $settings, $current_section ) {
		if ( 'deposits' !== $current_section ) {
			return $settings;
		}

		wp_enqueue_script( 'woocommerce-deposits-admin' );

		$payment_gateways        = WC()->payment_gateways->payment_gateways();
		$payment_gateway_options = array();

		foreach ( $payment_gateways as $gateway ) {
			$payment_gateway_options[ $gateway->id ] = $gateway->get_title();
		}

		$plans = WC_Deposits_Plans_Manager::get_plan_ids();

		$plan_ids = WC_Deposits_Plans_Manager::get_default_plan_ids();

		return apply_filters(
			'woocommerce_deposits_get_settings',
			array(
				array(
					'name' => __( 'Storewide Deposits Configuration', 'woocommerce-deposits' ),
					'type' => 'title',
					'desc' => __( 'Set default deposit options for all products across your store. You can edit specific product or variation deposit settings to override these global settings. To do this, navigate to <strong>Products > Edit a specific product > Deposits</strong>, or for variable products, go to <strong>Products > Edit a specific product > Deposits / Variations</strong>.', 'woocommerce-deposits' ),
					'id'   => 'deposits_defaults',
				),

				array(
					'name'     => __( 'Default Enable Deposits', 'woocommerce-deposits' ),
					'type'     => 'select',
					'class'    => 'wc-enhanced-select deposits-behavior-select',
					'desc'     => __( 'Controls whether deposits are enabled by default for products without specific deposit settings. When <strong>Disabled</strong>, customers must pay in full, the default WooCommerce payment process. When <strong>Optional</strong>, customers can choose to pay a deposit or the full amount. When <strong>Required</strong>, only deposits are allowed.', 'woocommerce-deposits' ),
					'desc_tip' => true,
					'default'  => 'no',
					'id'       => 'wc_deposits_default_enabled',
					'options'  => array(
						'no'       => __( 'No - Deposits are Disabled', 'woocommerce-deposits' ),
						'optional' => __( 'Yes - Deposits are Optional', 'woocommerce-deposits' ),
						'forced'   => __( 'Yes - Deposits are Required', 'woocommerce-deposits' ),
					),
					'tooltip'  => __( 'Determines whether a deposit is <b>Optional</b> (customers can choose to pay through a deposit or pay in full), <b>Required</b> (customers must pay using a deposit, paying the full amount isn\'t allowed) or <b>Disabled</b> (deposits are not allowed).', 'woocommerce-deposits' ),
				),

				array(
					'name'     => __( 'Default Payment Option', 'woocommerce-deposits' ),
					'type'     => 'select',
					'class'    => 'wc-enhanced-select deposits-payment-option',
					'desc'     => __( 'The payment method which appears pre-selected at the product page, when paying using deposits is marked as optional.', 'woocommerce-deposits' ),
					'desc_tip' => true,
					'tooltip'  => __( 'Controls the default payment selection that appears pre-selected at the product page, when paying using deposits is marked as <b>Optional</b>. This option is ignored if the deposit requirement is set to <b>Required</b>.', 'woocommerce-deposits' ),
					'default'  => 'deposit',
					'id'       => 'wc_deposits_default_selected_type',
					'options'  => array(
						'deposit' => __( 'Pay Deposit', 'woocommerce-deposits' ),
						'full'    => __( 'Pay in Full', 'woocommerce-deposits' ),
					),
				),

				array(
					'name'     => __( 'Deposit Calculation Method', 'woocommerce-deposits' ),
					'type'     => 'select',
					'class'    => 'wc-enhanced-select deposits-calculation-method',
					'desc'     => __( 'Choose how the deposit is calculated - e.g., a fixed amount, a percentage of the product price, or a payment plan.', 'woocommerce-deposits' ),
					'desc_tip' => true,
					'tooltip'  => __( 'Specify whether the deposit is a percentage of the product price, a fixed amount, or part of a payment plan. This setting determines how the deposit amount will be calculated for all products using the global settings.', 'woocommerce-deposits' ),
					'default'  => 'percent',
					'id'       => 'wc_deposits_default_type',
					'options'  => array(
						'percent' => __( 'Percentage', 'woocommerce-deposits' ),
						'fixed'   => __( 'Fixed Amount', 'woocommerce-deposits' ),
						'plan'    => __( 'Payment Plan', 'woocommerce-deposits' ),
					),
				),

				array(
					'name'        => __( 'Default Deposit Amount', 'woocommerce-deposits' ),
					'type'        => 'text',
					'desc'        => __( 'Enter the percentage or fixed amount to be used as the default deposit. Absolute value only, do not include currency or percent symbols.', 'woocommerce-deposits' ),
					'desc_tip'    => true,
					'tooltip'     => __( 'The amount customers need to pay as a deposit. For percentage, enter a number between 1-100. For fixed amount, enter the specific amount in your store\'s currency.', 'woocommerce-deposits' ),
					'default'     => '',
					'placeholder' => __( 'Enter amount', 'woocommerce-deposits' ),
					'id'          => 'wc_deposits_default_amount',
					'class'       => 'deposits-amount',
				),

				array(
					'name'              => __( 'Default Payment Plan', 'woocommerce-deposits' ),
					'type'              => 'multiselect',
					'class'             => 'wc-enhanced-select deposits-payment-plan',
					'css'               => 'width: 450px;',
					'desc'              => __( 'Select the default payment plans to use when the Deposit Calculation Method is set to Payment Plan.', 'woocommerce-deposits' ),
					'desc_tip'          => true,
					'tooltip'           => __( 'These payment plans will be available as options when customers are making a deposit payment. Only shown when Payment Plan is selected as the calculation method.', 'woocommerce-deposits' ),
					'default'           => array(),
					'id'                => 'wc_deposits_default_plans',
					'custom_attributes' => array(
						'data-plans-order' => join( ',', $plan_ids ),
					),
					'options'           => $plans,
				),

				array(
					'name'     => __( 'Disable Payment Gateways', 'woocommerce-deposits' ),
					'type'     => 'multiselect',
					'class'    => 'wc-enhanced-select deposits-payment-gateways',
					'css'      => 'width: 450px;',
					'desc'     => __( 'Select payment gateways that should be disabled when accepting deposits.', 'woocommerce-deposits' ),
					'desc_tip' => true,
					'tooltip'  => __( 'Selected payment gateways will not be available as payment options when a customer is making a deposit payment. This helps ensure compatibility with payment methods that may not support partial payments.', 'woocommerce-deposits' ),
					'default'  => '',
					'id'       => 'wc_deposits_disabled_gateways',
					'options'  => $payment_gateway_options,
				),

				array(
					'title'    => __( 'Order Again Behavior', 'woocommerce-deposits' ),
					'desc'     => __( 'Use original order\'s deposit settings on a reorder.', 'woocommerce-deposits' ),
					'desc_tip' => __( 'With this enabled, if a customer places a reorder, the same deposit settings as the original order will automatically be applied.', 'woocommerce-deposits' ),
					'tooltip'  => __( 'When a customer uses the "Order Again" feature, enabling this option will preserve the deposit settings from their original order, maintaining consistency in how they pay for the same items.', 'woocommerce-deposits' ),
					'id'       => 'wc_deposits_order_again_behaviour',
					'default'  => 'no',
					'type'     => 'checkbox',
					'class'    => 'deposits-order-again',
				),

				array(
					'type' => 'sectionend',
					'id'   => 'deposits_defaults',
				),
			)
		);
	}
}

WC_Deposits_Settings::get_instance();
